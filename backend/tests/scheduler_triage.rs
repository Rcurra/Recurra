//! Anvil-backed integration test for the scheduler's triage loop — the one
//! coverage gap Track 3 left open (backend/plan.md). The five-way match in
//! `process_subscriptions` triages *races*: chain state changing between
//! the due-list fetch and the simulate. A unit test can't produce those
//! honestly, so this spins a real anvil, deploys via the same canonical
//! `Deploy.s.sol` every other environment uses, fetches a genuinely-due
//! list, mutates chain state, and replays the stale list — then asserts on
//! chain state (balances, due-ness), never on log output.
//!
//! Branch coverage, by scenario:
//!   1. happy path      — simulate passes, tx fires, wait_for_success confirms
//!   2. NotDue          — charged externally after the fetch → skip, no double debit
//!   3. SubscriptionInactive — cancelled after the fetch → skip
//!   4. InsufficientVaultBalance — vault emptied after the fetch → skip, stays due
//!
//! `NotAuthorized` is deliberately not covered: the simulate impersonates
//! the on-chain authorizedExecutor read moments earlier, so that branch is
//! defensive against an authorizedExecutor rotation landing in the same
//! instant — not reachable deterministically without mocking the RPC.
//!
//! Skips (with a note) when anvil/forge aren't on PATH so a plain
//! `cargo test` works on any machine; CI sets RECURRA_REQUIRE_ANVIL=1 to
//! turn a silent skip into a failure there.

use std::process::Command;

use alloy::network::EthereumWallet;
use alloy::node_bindings::Anvil;
use alloy::primitives::{Address, U256};
use alloy::providers::{DynProvider, Provider, ProviderBuilder};
use alloy::signers::local::PrivateKeySigner;
use alloy::sol;

use backend::chain::AppState;
use backend::config::Config;
use backend::models::Subscription;
use backend::scheduler::{SubmitBackoff, process_subscriptions};

// Foundry's well-known test mnemonic, accounts #0 and #1 — public by
// definition, the same keys every fresh anvil unlocks.
const KEY_DEPLOYER: &str = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const KEY_SUBSCRIBER: &str = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const PLAN_AMOUNT: u64 = 10_000_000; // 10 USDC
const PLAN_INTERVAL: u64 = 3600;

sol! {
    // Test-side write surface — the backend's own bindings deliberately
    // exclude user/merchant-authority writes (subscribe, deposit, ...), so
    // the seeding calls are declared here instead of widening them.
    #[sol(rpc)]
    contract TestRegistry {
        function createPlan(address token, uint256 amount, uint256 interval) external returns (uint256);
        function subscribe(uint256 planId) external returns (uint256);
        function unsubscribe(uint256 subId) external;
    }
    #[sol(rpc)]
    contract TestVault {
        function deposit(address token, uint256 amount) external;
        function withdraw(address token, uint256 amount) external;
        function balances(address subscriber, address token) external view returns (uint256);
    }
    #[sol(rpc)]
    contract TestUsdc {
        function mint(address to, uint256 amount) external;
        function approve(address spender, uint256 value) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }
    #[sol(rpc)]
    contract TestExecutor {
        function executePayment(uint256 subId) external;
    }
}

fn on_path(bin: &str) -> bool {
    Command::new(bin)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Pull "Label: 0x..." out of Deploy.s.sol's console output.
fn parse_deployed(stdout: &str, label: &str) -> Address {
    stdout
        .lines()
        .find(|l| l.contains(label))
        .and_then(|l| l.split_whitespace().last())
        .and_then(|a| a.parse().ok())
        .unwrap_or_else(|| panic!("no '{label}' address in deploy output:\n{stdout}"))
}

fn wallet_provider(key: &str, rpc: &str) -> DynProvider {
    let signer: PrivateKeySigner = key.parse().expect("well-known key parses");
    ProviderBuilder::new()
        .wallet(EthereumWallet::from(signer))
        .connect_http(rpc.parse().expect("anvil endpoint is a valid url"))
        .erased()
}

/// The stale-list replay: the one entry for `sub_id` out of a due list
/// fetched BEFORE the state mutation a scenario is about to make.
fn stale_entry(due: &[Subscription], sub_id: u64) -> Vec<Subscription> {
    let entry: Vec<Subscription> = due.iter().filter(|s| s.id == sub_id).cloned().collect();
    assert_eq!(entry.len(), 1, "sub {sub_id} expected in the due list");
    entry
}

#[tokio::test]
async fn scheduler_triage_against_anvil() {
    if !on_path("anvil") || !on_path("forge") {
        assert!(
            std::env::var("RECURRA_REQUIRE_ANVIL").is_err(),
            "RECURRA_REQUIRE_ANVIL is set but anvil/forge aren't on PATH — CI is misconfigured"
        );
        eprintln!("skipping scheduler_triage_against_anvil: anvil/forge not on PATH");
        return;
    }

    let anvil = Anvil::new().spawn();
    let rpc = anvil.endpoint();

    // Deploy through the canonical script — same wiring as every real
    // environment (atomic setExecutor + authorizedExecutor = deployer).
    let contracts_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../contracts");
    let deploy = Command::new("forge")
        .args([
            "script",
            "script/Deploy.s.sol",
            "--rpc-url",
            &rpc,
            "--broadcast",
        ])
        .env("PRIVATE_KEY", KEY_DEPLOYER)
        .env("NO_COLOR", "1")
        .current_dir(contracts_dir)
        .output()
        .expect("failed to run forge script");
    assert!(
        deploy.status.success(),
        "deploy failed:\n{}\n{}",
        String::from_utf8_lossy(&deploy.stdout),
        String::from_utf8_lossy(&deploy.stderr)
    );
    let deploy_out = String::from_utf8_lossy(&deploy.stdout);
    let registry_addr = parse_deployed(&deploy_out, "SubscriptionRegistry:");
    let vault_addr = parse_deployed(&deploy_out, "SubscriptionVault:");
    let executor_addr = parse_deployed(&deploy_out, "PaymentExecutor:");
    let usdc_addr = parse_deployed(&deploy_out, "MockUSDC:");

    let deployer = wallet_provider(KEY_DEPLOYER, &rpc); // merchant + authorizedExecutor
    let subscriber = wallet_provider(KEY_SUBSCRIBER, &rpc);
    let subscriber_addr: Address = KEY_SUBSCRIBER
        .parse::<PrivateKeySigner>()
        .unwrap()
        .address();
    let merchant_addr: Address = KEY_DEPLOYER.parse::<PrivateKeySigner>().unwrap().address();

    // Seed: four identical plans (one per scenario — subs 1..=4 mirror plan
    // ids since both counters start at 1), 50 USDC of escrow shared across
    // them, all four subscriptions due immediately (subscribe() sets
    // nextPaymentDue = now).
    let registry_m = TestRegistry::new(registry_addr, &deployer);
    let registry_s = TestRegistry::new(registry_addr, &subscriber);
    let vault_s = TestVault::new(vault_addr, &subscriber);
    let usdc_s = TestUsdc::new(usdc_addr, &subscriber);

    for _ in 0..4 {
        registry_m
            .createPlan(
                usdc_addr,
                U256::from(PLAN_AMOUNT),
                U256::from(PLAN_INTERVAL),
            )
            .send()
            .await
            .unwrap()
            .watch()
            .await
            .unwrap();
    }
    usdc_s
        .mint(subscriber_addr, U256::from(100_000_000u64))
        .send()
        .await
        .unwrap()
        .watch()
        .await
        .unwrap();
    usdc_s
        .approve(vault_addr, U256::from(50_000_000u64))
        .send()
        .await
        .unwrap()
        .watch()
        .await
        .unwrap();
    vault_s
        .deposit(usdc_addr, U256::from(50_000_000u64))
        .send()
        .await
        .unwrap()
        .watch()
        .await
        .unwrap();
    for plan_id in 1..=4u64 {
        registry_s
            .subscribe(U256::from(plan_id))
            .send()
            .await
            .unwrap()
            .watch()
            .await
            .unwrap();
    }

    // The real AppState, exactly as main() would build it — local signer is
    // the deployer key, which Deploy.s.sol just wired as authorizedExecutor,
    // so the boot-time signer check must pass.
    let state = AppState::new(Config {
        port: 0,
        openfort_secret_key: String::new(),
        arbitrum_rpc: rpc.clone(),
        registry_address: registry_addr.to_string(),
        vault_address: vault_addr.to_string(),
        executor_address: Some(executor_addr.to_string()),
        local_signer_key: Some(KEY_DEPLOYER.to_string()),
        openfort_wallet_address: None,
        openfort_account_id: None,
        openfort_wallet_secret: None,
        openfort_publishable_key: None,
        scheduler_interval_secs: 60,
        executor_deploy_block: 0,
    })
    .await
    .expect("AppState builds against live anvil");
    assert!(
        state.scheduler_enabled,
        "signer == authorizedExecutor, boot check should pass"
    );

    let mut backoff = SubmitBackoff::default();

    let vault_balance = || async {
        vault_s
            .balances(subscriber_addr, usdc_addr)
            .call()
            .await
            .unwrap()
    };
    let merchant_usdc = || async { usdc_s.balanceOf(merchant_addr).call().await.unwrap() };

    // ── 1. Happy path: due + funded → the money moves ────────────────────
    let due = state.fetch_due_subscriptions().await.unwrap();
    assert_eq!(due.len(), 4, "all four seeded subs start due");
    let merchant_before = merchant_usdc().await;

    process_subscriptions(&state, stale_entry(&due, 1), &mut backoff)
        .await
        .unwrap();

    assert_eq!(vault_balance().await, U256::from(40_000_000u64));
    assert_eq!(
        merchant_usdc().await - merchant_before,
        U256::from(PLAN_AMOUNT)
    );
    let due_after = state.fetch_due_subscriptions().await.unwrap();
    assert!(
        !due_after.iter().any(|s| s.id == 1),
        "charged sub advanced one interval, no longer due"
    );

    // ── 2. NotDue race: charged externally between fetch and act ─────────
    let due = state.fetch_due_subscriptions().await.unwrap();
    let stale = stale_entry(&due, 2);
    // Fresh provider for the same key: `deployer`'s nonce filler cached its
    // count before AppState's sender (also key #0) fired scenario 1's tx —
    // reusing it now would send a stale nonce ("nonce too low", hit live).
    TestExecutor::new(executor_addr, wallet_provider(KEY_DEPLOYER, &rpc))
        .executePayment(U256::from(2u64))
        .send()
        .await
        .unwrap()
        .watch()
        .await
        .unwrap();
    assert_eq!(vault_balance().await, U256::from(30_000_000u64));

    process_subscriptions(&state, stale, &mut backoff)
        .await
        .unwrap();

    assert_eq!(
        vault_balance().await,
        U256::from(30_000_000u64),
        "stale replay must not double-charge — that's invariant #2"
    );

    // ── 3. SubscriptionInactive race: cancelled between fetch and act ────
    let due = state.fetch_due_subscriptions().await.unwrap();
    let stale = stale_entry(&due, 3);
    registry_s
        .unsubscribe(U256::from(3u64))
        .send()
        .await
        .unwrap()
        .watch()
        .await
        .unwrap();

    process_subscriptions(&state, stale, &mut backoff)
        .await
        .unwrap();

    assert_eq!(
        vault_balance().await,
        U256::from(30_000_000u64),
        "a cancelled sub must never be charged"
    );

    // ── 4. InsufficientVaultBalance race: vault emptied between fetch and
    //       act → skipped, and the sub STAYS due (the charge just waits for
    //       a top-up; no penalty, no debt) ──────────────────────────────
    let due = state.fetch_due_subscriptions().await.unwrap();
    let stale = stale_entry(&due, 4);
    vault_s
        .withdraw(usdc_addr, U256::from(30_000_000u64))
        .send()
        .await
        .unwrap()
        .watch()
        .await
        .unwrap();
    assert_eq!(vault_balance().await, U256::ZERO);
    let merchant_before = merchant_usdc().await;

    process_subscriptions(&state, stale, &mut backoff)
        .await
        .unwrap();

    assert_eq!(merchant_usdc().await, merchant_before, "nothing moved");
    let due_after = state.fetch_due_subscriptions().await.unwrap();
    assert!(
        due_after.iter().any(|s| s.id == 4),
        "an underfunded sub stays due — it charges on the next funded tick"
    );
}
