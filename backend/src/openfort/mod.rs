//! Openfort integration: shells out to the vendored `@openfort/cli`
//! (`../openfort-cli/`) instead of re-implementing Openfort's real signing
//! flow directly in Rust.
//!
//! Why a subprocess and not a hand-rolled REST client: creating a
//! `Delegated Account` (EIP-7702) is only step one — a live-wired
//! `POST /v1/transaction_intents` against a plain backend-wallet account ID
//! returns `"Account type not supported"`. The real flow needs an
//! ES256-signed `x-wallet-auth` JWT (built from `OPENFORT_WALLET_SECRET`,
//! a P-256 key) plus a full EIP-7702 authorization dance — exactly the class
//! of subtle signing code that already caused the worst bugs in this
//! project's ZeroDev integration (see frontend/plan.md's F4 error trail).
//! Openfort's own CLI already implements this correctly; shelling out to it
//! reuses that instead of re-deriving it under hackathon time pressure.
//! Documented tradeoff, not an oversight: this makes the backend depend on
//! Node.js/the CLI being present at runtime, not just the Rust binary — an
//! acceptable cost for a hackathon deploy, revisit for a real one.
//!
//! The CLI install is vendored and pinned (`openfort-cli/package.json` +
//! lockfile) rather than resolved fresh via `npx` on every process start —
//! `npx` also fails outright here since `@openfort/openfort-node`'s
//! postinstall gates on `only-allow pnpm`.

use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use serde_json::Value;
use tokio::process::Command;

use crate::errors::AppError;

/// Absolute path to the vendored CLI binary, resolved at compile time
/// relative to this crate's root — independent of whatever the process's
/// runtime working directory happens to be.
fn cli_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("openfort-cli/node_modules/.bin/openfort")
}

pub struct OpenfortClient {
    secret_key: String,
    wallet_secret: String,
    publishable_key: Option<String>,
}

pub struct SignedTransaction {
    pub tx_hash: String,
}

impl OpenfortClient {
    pub fn new(secret_key: String, wallet_secret: String, publishable_key: Option<String>) -> Self {
        Self {
            secret_key,
            wallet_secret,
            publishable_key,
        }
    }

    fn command(&self) -> Command {
        let mut cmd = Command::new(cli_path());
        // The CLI's own env var is OPENFORT_API_KEY, not OPENFORT_SECRET_KEY
        // (confirmed by running it — the skill docs disagree with the real
        // binary here).
        cmd.env("OPENFORT_API_KEY", &self.secret_key);
        cmd.env("OPENFORT_WALLET_SECRET", &self.wallet_secret);
        if let Some(pk) = &self.publishable_key {
            cmd.env("OPENFORT_PUBLISHABLE_KEY", pk);
        }
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        cmd
    }

    async fn run(&self, args: &[&str]) -> Result<Value, AppError> {
        let output = self
            .command()
            .args(args)
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("failed to spawn openfort CLI: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(AppError::Chain(format!(
                "openfort CLI exited with {}: {stderr}{stdout}",
                output.status
            )));
        }

        serde_json::from_slice(&output.stdout).map_err(|e| {
            AppError::Chain(format!(
                "openfort CLI: bad JSON output: {e} (raw: {})",
                String::from_utf8_lossy(&output.stdout)
            ))
        })
    }

    /// Extract a transaction hash from wherever the CLI's JSON output put it
    /// — `response.transactionHash` per the real API shape, with flatter
    /// fallbacks since `--format json` may unwrap differently by command.
    fn extract_tx_hash(value: &Value) -> Option<String> {
        value
            .get("response")
            .and_then(|r| r.get("transactionHash"))
            .or_else(|| value.get("transactionHash"))
            .or_else(|| value.get("hash"))
            .and_then(|h| h.as_str())
            .map(|s| s.to_string())
    }

    /// Send `executePayment(subId)` (or any raw call) through `account_id`
    /// (an Openfort `acc_...` ID — the scheduler resolves this from
    /// `Config.openfort_account_id`, not the wallet's on-chain address).
    /// The CLI's `send-transaction` auto-delegates the account via EIP-7702
    /// the first time it's used on a chain, so no separate delegation step
    /// is needed here.
    pub async fn send_transaction(
        &self,
        account_id: &str,
        to: &str,
        calldata: &str,
        chain_id: u64,
    ) -> Result<SignedTransaction, AppError> {
        let interactions =
            serde_json::json!([{ "to": to, "data": calldata, "value": "0" }]).to_string();
        let chain_id_str = chain_id.to_string();

        let result = self
            .run(&[
                "accounts",
                "evm",
                "send-transaction",
                account_id,
                "--chain-id",
                &chain_id_str,
                "--interactions",
                &interactions,
                "--format",
                "json",
            ])
            .await?;

        if let Some(hash) = Self::extract_tx_hash(&result) {
            return Ok(SignedTransaction { tx_hash: hash });
        }

        // Not broadcast in the immediate response — poll `transactions get`
        // using the intent ID, same reasoning as the receipt-polling
        // elsewhere in this codebase (a real state can lag its own report).
        let Some(intent_id) = result.get("id").and_then(|v| v.as_str()).map(String::from) else {
            return Err(AppError::Chain(format!(
                "openfort send-transaction: no transactionHash or id in output: {result}"
            )));
        };

        const MAX_ATTEMPTS: u32 = 6;
        for attempt in 1..=MAX_ATTEMPTS {
            tokio::time::sleep(Duration::from_millis(500 * attempt as u64)).await;
            let polled = self
                .run(&["transactions", "get", &intent_id, "--format", "json"])
                .await?;
            if let Some(hash) = Self::extract_tx_hash(&polled) {
                return Ok(SignedTransaction { tx_hash: hash });
            }
        }

        Err(AppError::Chain(format!(
            "openfort transaction intent {intent_id} never broadcast after {MAX_ATTEMPTS} polls"
        )))
    }
}
