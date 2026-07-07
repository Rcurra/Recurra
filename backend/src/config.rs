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
    /// `executePayment`. Optional today: the executor contract is still a stub,
    /// so this is unset until the M2 payment path lands. Becomes required then.
    #[allow(dead_code)]
    pub executor_address: Option<String>,
    /// How often the scheduler checks for due payments (seconds)
    pub scheduler_interval_secs: u64,
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
            scheduler_interval_secs: env::var("SCHEDULER_INTERVAL_SECS")
                .unwrap_or_else(|_| "60".into())
                .parse()
                .expect("SCHEDULER_INTERVAL_SECS must be a number"),
        }
    }
}

fn require(key: &str) -> String {
    env::var(key).unwrap_or_else(|_| panic!("missing required env var: {key}"))
}
