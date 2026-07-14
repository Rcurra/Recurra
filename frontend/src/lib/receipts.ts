// Per-subscription receipt history — a TEMPORARY STOPGAP. CONCEPT.md's
// rule is "reads come from the backend API, never the chain directly"; this
// file breaks that rule on purpose because the backend endpoint that should
// serve this (GET /api/payments — Track 2 in backend/plan.md) doesn't exist
// yet. Delete this file and read from that endpoint instead once it ships;
// nothing about the SubDetailModal UI consuming it should need to change,
// since it already returns the same TxReceipt shape wallet.ts's writes do.
//
// Found live 2026-07-14: not every public RPC allows a wide getLogs range
// without an archive-node subscription (publicnode.com's free Arbitrum
// Sepolia endpoint caps it well under 500 blocks). Arbitrum's own official
// endpoint (sepolia-rollup.arbitrum.io/rpc) does not have this restriction —
// use it here specifically, independent of whatever NEXT_PUBLIC_RPC_URL is
// set to, since a wide historical scan is exactly the case that breaks.
//
// Also found live 2026-07-14: a receipt only for PaymentExecuted meant a
// subscription with zero charges yet (the common case right after
// subscribing) showed nothing at all — no proof the subscribe+fund
// transaction itself ever happened, and nothing survived past cancelling.
// This scans all three subscription-lifetime events (Subscribed,
// PaymentExecuted, Unsubscribed) so the trail never goes empty.

import { createPublicClient, http, parseAbiItem, parseEventLogs } from 'viem';
import { getChain } from './chain';
import { getExecutorAddress, getExecutorDeployBlock, getRegistryAddress, getVaultAddress } from './contracts';
import { buildTxReceipt, type TxReceipt } from './wallet';

const subscribedEvent = parseAbiItem(
  'event Subscribed(uint256 indexed subId, address indexed subscriber, uint256 indexed planId)',
);
const unsubscribedEvent = parseAbiItem('event Unsubscribed(uint256 indexed subId)');
const paymentExecutedEvent = parseAbiItem(
  'event PaymentExecuted(uint256 indexed subId, address indexed subscriber, address indexed merchant, address token, uint256 amount)',
);
const depositedEvent = parseAbiItem(
  'event Deposited(address indexed subscriber, address indexed token, uint256 amount)',
);
const withdrawnEvent = parseAbiItem(
  'event Withdrawn(address indexed subscriber, address indexed token, uint256 amount)',
);
const debitedEvent = parseAbiItem(
  'event Debited(address indexed subscriber, address indexed token, uint256 amount, address recipient)',
);

export type SubscriptionReceipt = { kind: 'subscribed' | 'charged' | 'cancelled'; receipt: TxReceipt };
export type VaultReceipt = { kind: 'deposited' | 'withdrawn' | 'charged'; receipt: TxReceipt };

let logsClient: ReturnType<typeof createPublicClient> | null = null;

function getLogsClient() {
  const chain = getChain();
  // Only Arbitrum Sepolia needs the dedicated endpoint (anvil's own history
  // is trivially short); anywhere else, reuse the chain's normal RPC.
  const rpcUrl = chain.id === 421614 ? 'https://sepolia-rollup.arbitrum.io/rpc' : undefined;
  if (!logsClient || rpcUrl) {
    logsClient = createPublicClient({ chain, transport: http(rpcUrl) });
  }
  return logsClient;
}

// Subscribed carries no amount (the Registry never touches tokens — see
// CONCEPT.md's separation of concerns); the actual funding is a same-
// transaction Deposited event on the Vault. Reading the one transaction's
// own logs (not a second wide scan) finds it precisely.
async function findDepositedAmount(
  client: ReturnType<typeof getLogsClient>,
  txHash: `0x${string}`,
): Promise<bigint> {
  const txReceipt = await client.getTransactionReceipt({ hash: txHash });
  const [deposit] = parseEventLogs({ abi: [depositedEvent], eventName: 'Deposited', logs: txReceipt.logs });
  return deposit ? (deposit.args.amount as bigint) : 0n;
}

// The full receipt trail for one subscription — oldest first. Returns []
// (not an error) when the executor address isn't configured — an older env
// predating this feature, not a real failure.
export async function getSubscriptionReceipts(subId: number): Promise<SubscriptionReceipt[]> {
  const executor = getExecutorAddress();
  if (!executor) return [];

  const client = getLogsClient();
  const registry = getRegistryAddress();
  const vault = getVaultAddress();
  const fromBlock = getExecutorDeployBlock();
  const id = BigInt(subId);

  const [subscribedLogs, paymentLogs, unsubscribedLogs] = await Promise.all([
    client.getLogs({ address: registry, event: subscribedEvent, args: { subId: id }, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: executor, event: paymentExecutedEvent, args: { subId: id }, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: registry, event: unsubscribedEvent, args: { subId: id }, fromBlock, toBlock: 'latest' }),
  ]);

  const results: SubscriptionReceipt[] = [];

  for (const log of subscribedLogs) {
    const amount = await findDepositedAmount(client, log.transactionHash);
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      vault,
      amount,
    );
    results.push({ kind: 'subscribed', receipt });
  }

  for (const log of paymentLogs) {
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      log.args.merchant as string,
      log.args.amount as bigint,
    );
    results.push({ kind: 'charged', receipt });
  }

  for (const log of unsubscribedLogs) {
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      registry,
      0n,
    );
    results.push({ kind: 'cancelled', receipt });
  }

  return results.sort((a, b) =>
    a.receipt.blockNumber < b.receipt.blockNumber ? -1 : a.receipt.blockNumber > b.receipt.blockNumber ? 1 : 0,
  );
}

// Every completed money movement touching this address's vault escrow,
// across all subscriptions — deposits, withdrawals, and charges (Debited,
// merchant-bound). The subscription-scoped view above answers "what did
// this plan do"; this answers "what happened to my vault, full stop."
export async function getVaultHistory(address: string): Promise<VaultReceipt[]> {
  const vault = getVaultAddress();
  const client = getLogsClient();
  const fromBlock = getExecutorDeployBlock();
  const subscriber = address as `0x${string}`;

  const [depositLogs, withdrawLogs, debitLogs] = await Promise.all([
    client.getLogs({ address: vault, event: depositedEvent, args: { subscriber }, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: vault, event: withdrawnEvent, args: { subscriber }, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: vault, event: debitedEvent, args: { subscriber }, fromBlock, toBlock: 'latest' }),
  ]);

  const results: VaultReceipt[] = [];

  for (const log of depositLogs) {
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      vault,
      log.args.amount as bigint,
    );
    results.push({ kind: 'deposited', receipt });
  }

  for (const log of withdrawLogs) {
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      address,
      log.args.amount as bigint,
    );
    results.push({ kind: 'withdrawn', receipt });
  }

  for (const log of debitLogs) {
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      log.args.recipient as string,
      log.args.amount as bigint,
    );
    results.push({ kind: 'charged', receipt });
  }

  return results.sort((a, b) =>
    a.receipt.blockNumber < b.receipt.blockNumber ? -1 : a.receipt.blockNumber > b.receipt.blockNumber ? 1 : 0,
  );
}
