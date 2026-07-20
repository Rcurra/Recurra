// Persistent receipts for F6's cross-chain routes — localStorage, keyed per
// owner address, newest first. localStorage (not the backend) on purpose:
// Particle routes never touch our API — the canonical record is Particle's
// own indexer (universalx.app) and the chains themselves; this store is just
// the pointer trail (transactionId + tx hashes) so the user can get back to
// both after a reload. Losing it loses nothing but convenience.
//
// No SDK import here — this file must stay loadable without dragging in
// lib/particle.ts's polyfill side effects. Hydration from Particle's
// getTransaction lives in particle.ts; this module only stores its output.

export type RouteReceiptStatus = 'pending' | 'success' | 'failed';

export type RouteTokenDelta = {
  symbol: string;
  chainId: number;
  amount: number;
  usd: number;
};

export type RouteReceipt = {
  transactionId: string;
  createdAt: number;
  /** The USDC amount the user asked to land on Arbitrum, as typed ("0.50"). */
  amount: string;
  /** Destination address when it wasn't the owner's own (a withdrawal). */
  receiver?: string;
  status: RouteReceiptStatus;
  /** Chains the quote planned to touch; replaced by actuals on hydration. */
  fromChains: number[];
  toChains: number[];
  /** Filled by hydration from Particle's getTransaction. */
  feeUsd: number | null;
  /** Gas vs service split of feeUsd (service includes Particle's LP cut). */
  feeGasUsd: number | null;
  feeServiceUsd: number | null;
  sent: RouteTokenDelta[];
  /** What landed; Particle omits incr sometimes — render falls back to the
      requested amount on the destination chain. */
  received: RouteTokenDelta[];
  /** Per-chain execution transactions, once Particle reports them. */
  chainTxs: { chainId: number; txHash: string }[];
  /** One-time EIP-7702 delegation installs this route performed, if any. */
  delegations: { chainId: number; txHash: string }[];
};

// The EVM chains Particle UA can quote across today (CHAIN_ID enum), with
// explorer links for the receipt rows. An unknown chainId still renders —
// name falls back to "chain <id>", link falls back to universalx only.
const CHAINS: Record<number, { name: string; explorerTx: string }> = {
  1: { name: 'Ethereum', explorerTx: 'https://etherscan.io/tx/' },
  56: { name: 'BNB Chain', explorerTx: 'https://bscscan.com/tx/' },
  196: { name: 'X Layer', explorerTx: 'https://www.oklink.com/x-layer/tx/' },
  8453: { name: 'Base', explorerTx: 'https://basescan.org/tx/' },
  42161: { name: 'Arbitrum One', explorerTx: 'https://arbiscan.io/tx/' },
};

export function chainName(chainId: number): string {
  return CHAINS[chainId]?.name ?? `chain ${chainId}`;
}

export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const chain = CHAINS[chainId];
  return chain ? `${chain.explorerTx}${txHash}` : null;
}

export function universalxUrl(transactionId: string): string {
  return `https://universalx.app/activity/details?id=${transactionId}`;
}

// Capped so one enthusiastic demo session can't grow the key forever; the
// full history stays on universalx.app regardless.
const MAX_RECEIPTS = 20;

function storageKey(ownerAddress: string): string {
  return `recurra.routeReceipts.${ownerAddress.toLowerCase()}`;
}

// Stored receipts outlive code shapes — a route saved by an older build
// stays in localStorage forever (bitten live 2026-07-20: a receipt written
// before `received`/fee-split fields existed crashed the expanded card on
// `.length` of undefined). Every field the UI dereferences gets a default
// here, so old shapes render instead of throwing; hydration then fills
// them with real values on the next refresh.
function normalize(r: Partial<RouteReceipt>): RouteReceipt {
  return {
    transactionId: r.transactionId ?? '',
    createdAt: r.createdAt ?? Date.now(),
    amount: r.amount ?? '0',
    receiver: r.receiver,
    status: r.status ?? 'pending',
    fromChains: r.fromChains ?? [],
    toChains: r.toChains ?? [],
    feeUsd: r.feeUsd ?? null,
    feeGasUsd: r.feeGasUsd ?? null,
    feeServiceUsd: r.feeServiceUsd ?? null,
    sent: r.sent ?? [],
    received: r.received ?? [],
    chainTxs: r.chainTxs ?? [],
    delegations: r.delegations ?? [],
  };
}

export function loadReceipts(ownerAddress: string): RouteReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(ownerAddress));
    const parsed = raw ? (JSON.parse(raw) as Partial<RouteReceipt>[]) : [];
    return Array.isArray(parsed) ? parsed.filter((r) => r?.transactionId).map(normalize) : [];
  } catch {
    // Corrupt JSON (manual edits) — treat as empty rather than brick the
    // panel; the next save overwrites it wholesale.
    return [];
  }
}

function persist(ownerAddress: string, receipts: RouteReceipt[]): void {
  try {
    window.localStorage.setItem(storageKey(ownerAddress), JSON.stringify(receipts.slice(0, MAX_RECEIPTS)));
  } catch {
    // Quota/private-mode failures just lose persistence, never the route.
  }
}

export function addReceipt(ownerAddress: string, receipt: RouteReceipt): RouteReceipt[] {
  const next = [receipt, ...loadReceipts(ownerAddress).filter((r) => r.transactionId !== receipt.transactionId)];
  persist(ownerAddress, next);
  return next;
}

export function updateReceipt(
  ownerAddress: string,
  transactionId: string,
  patch: Partial<RouteReceipt>,
): RouteReceipt[] {
  const next = loadReceipts(ownerAddress).map((r) =>
    r.transactionId === transactionId ? { ...r, ...patch } : r,
  );
  persist(ownerAddress, next);
  return next;
}
