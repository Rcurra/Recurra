// Receipt history for one subscription / one vault. CHARGES — the money
// actually moving — come from the backend's GET /payments (PaymentExecuted
// history) per CONCEPT.md's "reads come from the backend API" rule; the
// original chain-scan for them is gone. What REMAINS a direct chain scan,
// deliberately and documented: the lifecycle markers (Subscribed /
// Unsubscribed on the registry, Deposited / Withdrawn on the vault), which
// the backend doesn't index — a subscription with zero charges yet (the
// common case right after subscribing) must still show proof the
// subscribe+fund happened, and a cancel must survive in the trail. Extend
// GET /payments into a full event index and this file shrinks again.
//
// Found live 2026-07-14: not every public RPC allows a wide getLogs range
// without an archive-node subscription (publicnode.com's free Arbitrum
// Sepolia endpoint caps it well under 500 blocks). Arbitrum's own official
// endpoint (sepolia-rollup.arbitrum.io/rpc) does not have this restriction —
// use it here specifically, independent of whatever NEXT_PUBLIC_RPC_URL is
// set to, since a wide historical scan is exactly the case that breaks.

import { createPublicClient, http, parseAbiItem, parseEventLogs } from 'viem';
import { api } from '@/services/api';
import type { Payment } from '@/types';
import { getChain } from './chain';
import { getExecutorDeployBlock, getRegistryAddress, getUsdcAddress, getVaultAddress } from './contracts';
import { buildTxReceipt, type TxReceipt } from './wallet';

const subscribedEvent = parseAbiItem(
  'event Subscribed(uint256 indexed subId, address indexed subscriber, uint256 indexed planId)',
);
const unsubscribedEvent = parseAbiItem('event Unsubscribed(uint256 indexed subId)');
const depositedEvent = parseAbiItem(
  'event Deposited(address indexed subscriber, address indexed token, uint256 amount)',
);
const withdrawnEvent = parseAbiItem(
  'event Withdrawn(address indexed subscriber, address indexed token, uint256 amount)',
);
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// A Payment from the API already carries everything TxReceipt needs — no
// per-row chain lookups (buildTxReceipt's block fetch) for charges anymore.
const paymentToReceipt = (p: Payment): TxReceipt => ({
  hash: p.txHash,
  to: p.merchant,
  amount: p.amount,
  blockNumber: p.blockNumber,
  timestamp: p.timestamp,
});

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

// The full receipt trail for one subscription — oldest first. Charges come
// from the API (filtered to this sub — GET /payments serves a subscriber's
// whole history); Subscribed/Unsubscribed stay chain scans per the header.
// `subscriber` is required so the API call can use the indexed filter
// instead of ever asking for everyone's history.
export async function getSubscriptionReceipts(
  subId: number,
  subscriber: string,
): Promise<SubscriptionReceipt[]> {
  const client = getLogsClient();
  const registry = getRegistryAddress();
  const vault = getVaultAddress();
  const fromBlock = getExecutorDeployBlock();
  const id = BigInt(subId);

  const [subscribedLogs, payments, unsubscribedLogs] = await Promise.all([
    client.getLogs({ address: registry, event: subscribedEvent, args: { subId: id }, fromBlock, toBlock: 'latest' }),
    api.payments.list(subscriber),
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

  for (const p of payments) {
    if (p.subId !== subId) continue;
    results.push({ kind: 'charged', receipt: paymentToReceipt(p) });
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

export type WalletReceipt = { kind: 'sent' | 'received' | 'deposited' | 'withdrawn'; receipt: TxReceipt };

// The wallet's own ledger — every USDC unit that ever crossed this EOA's
// boundary, in or out, regardless of where it came from or went. A single
// Transfer-event scan on the token itself covers all four cases (a deposit
// IS a Transfer(wallet, vault, ...) under the hood, a withdraw IS
// Transfer(vault, wallet, ...), same for Send and any plain incoming
// transfer) — no need to separately reconcile against Deposited/Withdrawn/
// PaymentExecuted the way getVaultHistory does, since none of those move
// the wallet's own balance except through a Transfer this scan already sees.
// Deliberately excludes charges: a scheduler tick debits the VAULT, never
// the wallet directly, so it has no place in "what happened to my wallet."
export async function getWalletHistory(address: string): Promise<WalletReceipt[]> {
  const usdc = getUsdcAddress();
  const vault = getVaultAddress();
  const client = getLogsClient();
  const fromBlock = getExecutorDeployBlock();
  const account = address as `0x${string}`;

  const [outgoing, incoming] = await Promise.all([
    client.getLogs({ address: usdc, event: transferEvent, args: { from: account }, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: usdc, event: transferEvent, args: { to: account }, fromBlock, toBlock: 'latest' }),
  ]);

  const results: WalletReceipt[] = [];
  const isVault = (a: string) => a.toLowerCase() === vault.toLowerCase();

  for (const log of outgoing) {
    const to = log.args.to as string;
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      to,
      log.args.value as bigint,
    );
    results.push({ kind: isVault(to) ? 'deposited' : 'sent', receipt });
  }

  for (const log of incoming) {
    const from = log.args.from as string;
    const receipt = await buildTxReceipt(
      { transactionHash: log.transactionHash, blockNumber: log.blockNumber },
      from,
      log.args.value as bigint,
    );
    results.push({ kind: isVault(from) ? 'withdrawn' : 'received', receipt });
  }

  return results.sort((a, b) =>
    a.receipt.blockNumber < b.receipt.blockNumber ? -1 : a.receipt.blockNumber > b.receipt.blockNumber ? 1 : 0,
  );
}

// Every completed money movement touching this address's vault escrow,
// across all subscriptions — deposits, withdrawals, and charges. Charges
// come from the API: every Debited has a 1:1 PaymentExecuted in the same
// transaction (executePayment emits both), so GET /payments IS the
// charge history — no separate Debited scan needed. The subscription-
// scoped view above answers "what did this plan do"; this answers "what
// happened to my vault, full stop."
export async function getVaultHistory(address: string): Promise<VaultReceipt[]> {
  const vault = getVaultAddress();
  const client = getLogsClient();
  const fromBlock = getExecutorDeployBlock();
  const subscriber = address as `0x${string}`;

  const [depositLogs, withdrawLogs, payments] = await Promise.all([
    client.getLogs({ address: vault, event: depositedEvent, args: { subscriber }, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: vault, event: withdrawnEvent, args: { subscriber }, fromBlock, toBlock: 'latest' }),
    api.payments.list(address),
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

  for (const p of payments) {
    results.push({ kind: 'charged', receipt: paymentToReceipt(p) });
  }

  return results.sort((a, b) =>
    a.receipt.blockNumber < b.receipt.blockNumber ? -1 : a.receipt.blockNumber > b.receipt.blockNumber ? 1 : 0,
  );
}
