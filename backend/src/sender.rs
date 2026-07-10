//! How the scheduler's `executePayment` transaction gets signed and submitted.
//!
//! Selected once at startup, two backends behind one `send()`:
//!
//!   - [`TxSender::Local`] — an in-process wallet signing straight against the
//!     RPC. This is the anvil / M2 path: `Deploy.s.sol` sets `authorizedExecutor`
//!     to a local anvil key, and Openfort's hosted TEE can't reach a local node,
//!     so autonomous firing on anvil *must* sign locally.
//!   - [`TxSender::Openfort`] — the hosted TEE wallet, for public
//!     testnet/mainnet (M3+).
//!
//! The scheduler is agnostic to which is live: it hands over `(to, calldata)`
//! and gets back an on-chain tx hash.

use std::sync::Arc;

use alloy::network::TransactionBuilder;
use alloy::primitives::{Address, Bytes};
use alloy::providers::{DynProvider, Provider};
use alloy::rpc::types::TransactionRequest;

use crate::errors::AppError;
use crate::openfort::OpenfortClient;

/// A signer+submitter for the one write the backend authors.
#[derive(Clone)]
pub enum TxSender {
    /// Wallet-enabled provider — the builder's fillers bake signing, nonce and
    /// gas into `send_transaction`, so a bare `to`/`input` request is enough.
    Local(DynProvider),
    /// Hosted TEE signer. `chain_id` rides along in the Openfort payload since
    /// the request never touches a local provider that would know it.
    Openfort {
        client: Arc<OpenfortClient>,
        chain_id: u64,
    },
}

impl TxSender {
    /// Sign and submit a single call, returning the on-chain tx hash as a
    /// `0x`-prefixed string. Does not wait for the receipt — the scheduler
    /// simulates first, so a submitted tx is expected to land.
    pub async fn send(&self, to: Address, calldata: Bytes) -> Result<String, AppError> {
        match self {
            TxSender::Local(provider) => {
                let tx = TransactionRequest::default().with_to(to).with_input(calldata);
                let pending = provider
                    .send_transaction(tx)
                    .await
                    .map_err(|e| AppError::Chain(format!("local tx submit failed: {e}")))?;
                Ok(pending.tx_hash().to_string())
            }
            TxSender::Openfort { client, chain_id } => {
                let data = format!("0x{}", alloy::hex::encode(&calldata));
                let signed = client
                    .send_transaction(&to.to_checksum(None), &data, *chain_id)
                    .await?;
                Ok(signed.tx_hash)
            }
        }
    }
}
