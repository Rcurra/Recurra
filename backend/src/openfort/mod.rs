use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

pub struct OpenfortClient {
    http: Client,
    secret_key: String,
}

#[derive(Serialize)]
struct TransactionPayload {
    to: String,
    data: String, // ABI-encoded calldata
    chain_id: u64,
}

#[derive(Deserialize)]
pub struct SignedTransaction {
    // Read once the scheduler's payment path calls send_transaction.
    #[allow(dead_code)]
    pub tx_hash: String,
}

impl OpenfortClient {
    pub fn new(secret_key: String) -> Self {
        Self {
            http: Client::new(),
            secret_key,
        }
    }

    // Signs and submits a transaction through Openfort's TEE wallet.
    // Returns the on-chain tx hash.
    //
    // Not yet called: the scheduler's payment path is blocked on
    // PaymentExecutor.executePayment landing on-chain. Kept wired and ready.
    #[allow(dead_code)]
    pub async fn send_transaction(
        &self,
        to: &str,
        calldata: &str,
        chain_id: u64,
    ) -> Result<SignedTransaction, AppError> {
        let payload = TransactionPayload {
            to: to.to_string(),
            data: calldata.to_string(),
            chain_id,
        };

        let res = self
            .http
            .post("https://api.openfort.xyz/v1/transaction_intents")
            .bearer_auth(&self.secret_key)
            .json(&payload)
            .send()
            .await?
            .json::<SignedTransaction>()
            .await?;

        Ok(res)
    }
}
