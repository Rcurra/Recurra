use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub openfort_secret_key: String,
    pub arbitrum_rpc: String,
    pub registry_address: String,
    /// Read once the vault's `balances()` is surfaced for dashboard/history.
    #[allow(dead_code)]
    pub vault_address: String,
    /// The `PaymentExecutor` address the scheduler targets with
    /// `executePayment`. Optional so the read-only API still boots without it;
    /// when unset the scheduler logs due subs but can't fire.
    pub executor_address: Option<String>,
    /// Private key for the local signing path (anvil / M2 e2e). When set, the
    /// scheduler signs `executePayment` in-process against `ARBITRUM_RPC`
    /// instead of routing through Openfort — Openfort's hosted TEE can't reach a
    /// local anvil node. Unset in staging/prod, where Openfort (M3) takes over.
    pub local_signer_key: Option<String>,
    /// The Openfort TEE wallet's own address — used only to verify it matches
    /// the on-chain `authorizedExecutor` at boot (see `AppState::new`'s signer
    /// check). Not needed on the local-signer path, where the address is
    /// derived straight from the key. This backend's Openfort integration is a
    /// single `send_transaction` call with no account-lookup API, so the
    /// address is provisioned once via the Openfort dashboard and pasted here
    /// rather than fetched live.
    pub openfort_wallet_address: Option<String>,
    /// The same wallet's Openfort account ID (`acc_...`, from `openfort
    /// accounts evm create`) — required on the Openfort path to actually
    /// submit a transaction intent; the API references accounts by this ID,
    /// not by on-chain address.
    pub openfort_account_id: Option<String>,
    /// EC P-256 wallet-auth secret (base64 PKCS8 DER), from the Openfort
    /// dashboard's "Backend wallet keys" → Wallet secret. Required by the
    /// vendored `openfort-cli` to actually sign/send a transaction through a
    /// backend wallet (the two-layer `wallet_auth` scheme) — not needed on
    /// the local-signer path.
    pub openfort_wallet_secret: Option<String>,
    /// Publishable key (`pk_test_...`) — the CLI's `accounts evm create`
    /// requires it; kept here too in case `send-transaction` ever does.
    pub openfort_publishable_key: Option<String>,
    /// How often the scheduler checks for due payments (seconds)
    pub scheduler_interval_secs: u64,
    /// First block to scan for `PaymentExecuted` logs (`GET /api/payments`) —
    /// the executor's deploy block, so history scans never walk pre-deploy
    /// chain. Defaults to 0 (fine on anvil's short history); should always be
    /// set explicitly on a public network — `AppState::new` warns once if it
    /// looks unset while an executor is configured.
    pub executor_deploy_block: u64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3001".into())
                .parse()
                .expect("PORT must be a number"),
            openfort_secret_key: require("OPENFORT_SECRET_KEY"),
            arbitrum_rpc: require("ARBITRUM_RPC"),
            registry_address: require("SUBSCRIPTION_REGISTRY_ADDRESS"),
            vault_address: require("SUBSCRIPTION_VAULT_ADDRESS"),
            executor_address: env::var("EXECUTOR_ADDRESS").ok().filter(|s| !s.is_empty()),
            local_signer_key: env::var("LOCAL_SIGNER_PRIVATE_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            openfort_wallet_address: env::var("OPENFORT_WALLET_ADDRESS")
                .ok()
                .filter(|s| !s.is_empty()),
            openfort_account_id: env::var("OPENFORT_ACCOUNT_ID")
                .ok()
                .filter(|s| !s.is_empty()),
            openfort_wallet_secret: env::var("OPENFORT_WALLET_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
            openfort_publishable_key: env::var("OPENFORT_PUBLISHABLE_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            scheduler_interval_secs: env::var("SCHEDULER_INTERVAL_SECS")
                .unwrap_or_else(|_| "60".into())
                .parse()
                .expect("SCHEDULER_INTERVAL_SECS must be a number"),
            executor_deploy_block: env::var("EXECUTOR_DEPLOY_BLOCK")
                .unwrap_or_else(|_| "0".into())
                .parse()
                .expect("EXECUTOR_DEPLOY_BLOCK must be a number"),
        }
    }
}

fn require(key: &str) -> String {
    env::var(key).unwrap_or_else(|_| panic!("missing required env var: {key}"))
}
