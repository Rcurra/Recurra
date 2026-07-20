'use client';

import { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { InlineError } from '@/components/InlineError';
import { parseUSDC } from '@/lib/format';
import { PARTICLE_ENABLED, getUnifiedBalance, hydrateRouteReceipt, routeToArbitrum } from '@/lib/particle';
import {
  addReceipt,
  chainName,
  explorerTxUrl,
  loadReceipts,
  universalxUrl,
  updateReceipt,
  type RouteReceipt,
} from '@/lib/routeReceipts';
import { walletErrorMessage } from '@/lib/wallet';

// F6's cross-chain fund step — a separate demo beat from the main deposit
// flow above it, not a replacement. Particle's Universal Accounts are
// mainnet-only (no testnet anywhere in their stack); this whole panel is
// invisible unless NEXT_PUBLIC_PARTICLE_ENABLED=1, and the default deposit
// path in VaultModal works identically whether this exists or not.
export function ParticleFundAside({ address, onRouted }: { address: string | null; onRouted: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState('');
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<RouteReceipt[]>([]);
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  // Pull what actually happened from Particle's indexer and fold it into
  // the stored receipt. Loops until the status turns terminal or attempts
  // run out; a receipt still pending after that just gets re-checked on
  // the next mount — Particle's record doesn't expire.
  async function refreshReceipt(owner: string, transactionId: string, attempts: number) {
    for (let i = 0; i < attempts; i++) {
      try {
        const live = await hydrateRouteReceipt(owner, transactionId);
        setReceipts(
          updateReceipt(owner, transactionId, {
            status: live.status,
            feeUsd: live.feeUsd,
            feeGasUsd: live.feeGasUsd,
            feeServiceUsd: live.feeServiceUsd,
            sent: live.sent,
            received: live.received,
            chainTxs: live.chainTxs,
            // Keep the quote's planned chains until Particle reports
            // actuals — right after send the indexer can answer with
            // empty arrays for a beat.
            ...(live.fromChains.length > 0 ? { fromChains: live.fromChains } : {}),
            ...(live.toChains.length > 0 ? { toChains: live.toChains } : {}),
          }),
        );
        if (live.status !== 'pending') return;
      } catch {
        // Indexer lag right after send ("transaction not found") — retry.
      }
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = address ? loadReceipts(address) : [];
      // Local reads are sync, but land the state a tick later so this
      // effect never re-renders mid-commit (react-hooks/set-state-in-effect).
      await Promise.resolve();
      if (cancelled) return;
      setReceipts(stored);
      // One refresh for anything the last session left unresolved — still
      // pending, or terminal but missing execution links (receipts saved
      // by an older build of this store).
      if (address) {
        for (const r of stored) {
          if (r.status === 'pending' || r.chainTxs.length === 0) {
            void refreshReceipt(address, r.transactionId, 1);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!PARTICLE_ENABLED) return null;

  async function handleCheck() {
    if (!address) return;
    setChecking(true);
    setError(null);
    try {
      const { totalUsd } = await getUnifiedBalance(address);
      setBalance(totalUsd);
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  // Empty means "to this wallet" (the original fund-the-vault flow); a
  // filled field turns the route into a withdrawal to any Arbitrum address.
  const receiverTrimmed = receiver.trim();
  const receiverValid = receiverTrimmed === '' || isAddress(receiverTrimmed);
  const isWithdrawal =
    receiverTrimmed !== '' && address !== null && receiverTrimmed.toLowerCase() !== address.toLowerCase();

  async function handleRoute() {
    if (!address || !receiverValid) return;
    const amountUnits = parseUSDC(amount);
    if (amountUnits === null || amountUnits <= 0n) return;
    setRouting(true);
    setError(null);
    try {
      const result = await routeToArbitrum(address, amountUnits, isWithdrawal ? receiverTrimmed : undefined);
      if (result.transactionId) {
        const receipt: RouteReceipt = {
          transactionId: result.transactionId,
          createdAt: Date.now(),
          amount: (Number(amountUnits) / 1e6).toString(),
          receiver: isWithdrawal ? receiverTrimmed : undefined,
          status: 'pending',
          fromChains: result.plannedChains.filter((c) => c !== 42161),
          toChains: [42161],
          feeUsd: null,
          feeGasUsd: null,
          feeServiceUsd: null,
          sent: [],
          received: [],
          chainTxs: [],
          delegations: result.delegations,
        };
        setReceipts(addReceipt(address, receipt));
        setReceiptsOpen(true);
        void refreshReceipt(address, result.transactionId, 10);
      }
      setAmount('');
      setReceiver('');
      onRouted();
    } catch (e) {
      // routeToArbitrum only logs its quote/send stages; the signing steps
      // between them (Magic 7702 auths, rootHash personal_sign) throw
      // straight through — log here so no failure is console-invisible
      // (bitten 2026-07-19: an error surfaced in the UI with nothing to
      // debug from).
      console.error('ParticleFundAside: route failed', e);
      setError(walletErrorMessage(e));
    } finally {
      setRouting(false);
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Or fund from another chain
      </p>
      <p className="mb-3 text-[11px] font-light text-ink-muted">
        Pay from whatever chain already holds your USDC — it lands at your real address on Arbitrum
        One mainnet. A separate live moment from the vault above (that&apos;s still on Sepolia for
        this demo) — real funds, real chains, no testnet here.
      </p>

      <button
        onClick={handleCheck}
        disabled={checking || !address}
        className="numeric mb-3 w-full rounded-xl border border-line bg-canvas/60 px-4 py-3 text-left text-xs text-ink transition hover:border-ink/40 disabled:opacity-50"
      >
        {checking ? 'Checking…' : balance !== null ? `Cross-chain balance: $${balance.toFixed(2)}` : 'Check cross-chain balance'}
      </button>

      <div className="mb-3 flex gap-2">
        <div className="flex w-full items-center gap-2 rounded-xl border border-line bg-canvas/60 px-4 py-3 transition focus-within:border-ink/40">
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (error) setError(null);
            }}
            disabled={routing}
            placeholder="0.00"
            inputMode="decimal"
            className="numeric w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
          />
          <span className="numeric shrink-0 text-xs text-ink-faint">USDC</span>
        </div>
        <button
          onClick={handleRoute}
          disabled={routing || !address || !receiverValid || !((parseUSDC(amount) ?? 0n) > 0n)}
          className="shrink-0 rounded-xl border border-ink/30 bg-canvas/40 px-4 text-[11px] tracking-[0.08em] text-ink transition hover:border-ink/60 disabled:opacity-40"
        >
          {routing ? 'Routing…' : isWithdrawal ? 'Withdraw' : 'Route to Arbitrum'}
        </button>
      </div>

      <div
        className={`mb-3 rounded-xl border bg-canvas/60 px-4 py-3 transition focus-within:border-ink/40 ${
          receiverValid ? 'border-line' : 'border-ink/60'
        }`}
      >
        <input
          value={receiver}
          onChange={(e) => {
            setReceiver(e.target.value);
            if (error) setError(null);
          }}
          disabled={routing}
          placeholder="destination address — optional, defaults to this wallet"
          spellCheck={false}
          className="numeric w-full bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
      </div>
      {!receiverValid && (
        <p className="-mt-1 mb-2 text-[11px] text-ink-muted">
          That doesn&apos;t look like an EVM address (0x + 40 hex characters).
        </p>
      )}

      {error && (
        <div className="mb-2">
          <InlineError message={error} />
        </div>
      )}

      {/* ── route receipts — every route ever sent from this browser,
          persisted per address, same collapsed-by-default pattern as
          VaultModal's History (auto-opened right after a fresh route).
          The canonical record is Particle's indexer; these rows are the
          pointer trail back to it and to each chain's explorer. ── */}
      {receipts.length > 0 && (
        <>
          <button
            onClick={() => setReceiptsOpen((o) => !o)}
            className="mt-1 flex w-full items-center justify-between text-left"
            aria-expanded={receiptsOpen}
          >
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Route receipts ({receipts.length})
            </span>
            <svg
              width="9"
              height="6"
              viewBox="0 0 9 6"
              className={`shrink-0 text-ink-faint transition-transform duration-300 ${receiptsOpen ? 'rotate-180' : ''}`}
            >
              <path d="M1 1 L4.5 4.5 L8 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          {receiptsOpen && (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {receipts.map((r, i) => (
                <RouteReceiptRow key={r.transactionId} receipt={r} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatTokenAmount(value: number): string {
  // Up to 6 meaningful decimals (USDC's own precision), trailing zeros
  // dropped — 0.25 stays "0.25", 0.000153 ETH stays legible.
  return Number(value.toFixed(6)).toString();
}

// One labeled line of the expanded card — label column fixed so the values
// align into the receipt shape.
function ReceiptLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-[72px] shrink-0 pt-px text-[9px] uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function RouteReceiptRow({ receipt, defaultOpen }: { receipt: RouteReceipt; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const when = new Date(receipt.createdAt).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const statusLabel =
    receipt.status === 'pending' ? 'routing…' : receipt.status === 'failed' ? 'failed' : 'landed';
  const destination = receipt.toChains.map(chainName).join(', ') || 'Arbitrum One';
  const linkClass = 'text-ink underline decoration-dotted underline-offset-2';

  // Per-chain link groups: every chain this route touched, each with its
  // execution tx and (when this route installed one) the delegation tx.
  const chainIds = [
    ...new Set([...receipt.chainTxs.map((t) => t.chainId), ...receipt.delegations.map((d) => d.chainId)]),
  ];

  // Particle sometimes omits incr even on success — fall back to the
  // requested amount on the destination chain, which is what the calldata
  // guaranteed.
  const received =
    receipt.received.length > 0
      ? receipt.received
      : [{ symbol: 'USDC', chainId: receipt.toChains[0] ?? 42161, amount: Number(receipt.amount), usd: 0 }];

  return (
    <div className="rounded-xl border border-line bg-canvas/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="numeric min-w-0 truncate text-xs text-ink">
          {receipt.amount} USDC →{' '}
          {receipt.receiver ? `${receipt.receiver.slice(0, 6)}…${receipt.receiver.slice(-4)}` : destination}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-[10px] text-ink-faint">{when}</span>
          <span
            className={`text-[10px] uppercase tracking-[0.15em] ${
              receipt.status === 'pending' ? 'animate-pulse text-ink-faint' : 'text-ink-muted'
            }`}
          >
            {statusLabel}
          </span>
          <svg
            width="9"
            height="6"
            viewBox="0 0 9 6"
            className={`self-center text-ink-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M1 1 L4.5 4.5 L8 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          {receipt.sent.length > 0 ? (
            <ReceiptLine label="Sent">
              {receipt.sent.map((s) => (
                <p key={`${s.chainId}-${s.symbol}`} className="numeric flex justify-between gap-2 text-[11px] text-ink">
                  <span className="min-w-0 truncate">
                    {formatTokenAmount(s.amount)} {s.symbol} · {chainName(s.chainId)}
                  </span>
                  <span className="shrink-0 text-ink-muted">${s.usd.toFixed(2)}</span>
                </p>
              ))}
            </ReceiptLine>
          ) : (
            <ReceiptLine label="Sent">
              <p className="animate-pulse text-[11px] text-ink-faint">
                {receipt.status === 'pending' ? 'confirming on-chain…' : '—'}
              </p>
            </ReceiptLine>
          )}

          <ReceiptLine label="Received">
            {received.map((r) => (
              <p key={`${r.chainId}-${r.symbol}`} className="numeric flex justify-between gap-2 text-[11px] text-ink">
                <span className="min-w-0 truncate">
                  {formatTokenAmount(r.amount)} {r.symbol} · {chainName(r.chainId)}
                </span>
                {r.usd > 0 && <span className="shrink-0 text-ink-muted">${r.usd.toFixed(2)}</span>}
              </p>
            ))}
          </ReceiptLine>

          {receipt.receiver && (
            <ReceiptLine label="To">
              <p className="numeric break-all text-[11px] text-ink">{receipt.receiver}</p>
            </ReceiptLine>
          )}

          {receipt.feeUsd !== null && (
            <ReceiptLine label="Fees">
              <p className="numeric text-[11px] text-ink">
                ${receipt.feeUsd.toFixed(2)}
                {receipt.feeGasUsd !== null && receipt.feeServiceUsd !== null && (
                  <span className="text-ink-muted">
                    {' '}
                    (gas ${receipt.feeGasUsd.toFixed(2)} · service ${receipt.feeServiceUsd.toFixed(2)})
                  </span>
                )}
              </p>
            </ReceiptLine>
          )}

          {chainIds.map((chainId) => {
            const delegation = receipt.delegations.find((d) => d.chainId === chainId);
            const txs = receipt.chainTxs.filter((t) => t.chainId === chainId);
            return (
              <ReceiptLine key={chainId} label={chainName(chainId)}>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {delegation && explorerTxUrl(chainId, delegation.txHash) && (
                    <a
                      href={explorerTxUrl(chainId, delegation.txHash)!}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass}
                    >
                      delegation ↗
                    </a>
                  )}
                  {txs.map((tx) =>
                    explorerTxUrl(chainId, tx.txHash) ? (
                      <a
                        key={tx.txHash}
                        href={explorerTxUrl(chainId, tx.txHash)!}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        transaction ↗
                      </a>
                    ) : null,
                  )}
                  {!delegation && txs.length === 0 && (
                    <span className="animate-pulse text-ink-faint">confirming…</span>
                  )}
                </p>
              </ReceiptLine>
            );
          })}

          <ReceiptLine label="Full detail">
            <p className="text-[11px]">
              <a
                href={universalxUrl(receipt.transactionId)}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                universalx.app ↗
              </a>
            </p>
          </ReceiptLine>
        </div>
      )}
    </div>
  );
}
