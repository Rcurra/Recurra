'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '@/components/GlassPanel';
import { InlineError } from '@/components/InlineError';
import { LoadingLine } from '@/components/LoadingLine';
import { ReceiptListRow } from '@/components/ReceiptListRow';
import { TxReceiptCard } from '@/components/TxReceiptCard';
import { formatUSDC, parseUSDC } from '@/lib/format';
import { getVaultHistory, type VaultReceipt } from '@/lib/receipts';
import { approveAndDeposit, withdraw } from '@/lib/zerodev';
import { mintTestUsdc, walletErrorMessage, type TxReceipt } from '@/lib/wallet';

const HISTORY_TITLES: Record<VaultReceipt['kind'], string> = {
  deposited: 'added to vault',
  withdrawn: 'withdrawn',
  charged: 'charged',
};

// The faucet is a dev/testnet-only escape hatch (MockUSDC.mint() is open
// to anyone) — same flag the dev-signer path already gates on, so it can
// never appear pointed at a real deploy.
const isDevWallet = process.env.NEXT_PUBLIC_DEV_WALLET === '1';

type Done = { kind: 'deposit' | 'withdraw'; receipt: TxReceipt };

// The open vault — single calm column in the wallet modal's anatomy:
// balance, the plan facts, one amount, two actions. Every action that
// moves money ends in the same chain-sourced receipt the wallet's Send
// uses. The old clock-face door and the fake "session activity" preview
// are gone — nothing decorative, nothing pretending.
// Portaled to <body>, fixed backdrop: both modal scars healed from birth.
export function VaultModal({
  open,
  onClose,
  address,
  balance,
  onChanged,
  stats,
  monthlyTotalRaw,
}: {
  open: boolean;
  onClose: () => void;
  address: string | null;
  balance: bigint | null;
  onChanged: () => void;
  stats: { activePlans: string; monthlyTotal: string; nextCharge: string };
  // Raw bigint alongside stats.monthlyTotal's pre-formatted string — the
  // withdraw-underfunding check needs the real number, not display text.
  monthlyTotalRaw: bigint;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <VaultModalContent
      onClose={onClose}
      address={address}
      balance={balance}
      onChanged={onChanged}
      stats={stats}
      monthlyTotalRaw={monthlyTotalRaw}
    />
  );
}

function VaultModalContent({
  onClose,
  address,
  balance,
  onChanged,
  stats,
  monthlyTotalRaw,
}: {
  onClose: () => void;
  address: string | null;
  balance: bigint | null;
  onChanged: () => void;
  stats: { activePlans: string; monthlyTotal: string; nextCharge: string };
  monthlyTotalRaw: bigint;
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | 'mint' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  // A withdraw that would leave the vault short of its own monthly total
  // gets a warning instead of executing immediately — never a block
  // (withdraw() never reverting for policy reasons is a permanent
  // contract invariant, "uncommitted balance is always theirs, instantly")
  // but a subscriber who's about to strand their own plan should know
  // before they sign, not find out when a charge quietly fails later.
  const [confirmingRiskyWithdraw, setConfirmingRiskyWithdraw] = useState(false);

  const [history, setHistory] = useState<VaultReceipt[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getVaultHistory(address)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch((e) => {
        if (!cancelled) setHistoryError(walletErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
    // `done` is a deliberate re-trigger, not read in the body — re-reads
    // history after every completed action so a fresh deposit/withdraw
    // shows up without waiting on a poll.
  }, [address, done]);

  const amountUnits = parseUSDC(amount);
  const amountInvalid = amount.length > 0 && amountUnits === null;
  const canAct = address !== null && amountUnits !== null && amountUnits > 0n && busy === null;
  const disabledReason = !address
    ? 'Not logged in'
    : amount.length === 0
      ? 'Enter an amount above'
      : amountInvalid
        ? 'Enter a valid amount'
        : undefined;

  async function run(kind: 'deposit' | 'withdraw') {
    if (!address || amountUnits === null) return;
    if (
      kind === 'withdraw' &&
      !confirmingRiskyWithdraw &&
      balance !== null &&
      monthlyTotalRaw > 0n &&
      balance - amountUnits < monthlyTotalRaw
    ) {
      setConfirmingRiskyWithdraw(true);
      return;
    }
    setConfirmingRiskyWithdraw(false);
    setBusy(kind);
    setActionError(null);
    try {
      const receipt =
        kind === 'deposit'
          ? await approveAndDeposit(address, amountUnits)
          : await withdraw(address, amountUnits);
      setDone({ kind, receipt });
      setAmount('');
      onChanged();
    } catch (e) {
      setActionError(walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleFaucet() {
    if (!address) return;
    setBusy('mint');
    setActionError(null);
    try {
      await mintTestUsdc(address, 100_000_000n); // 100 mUSDC
      onChanged();
    } catch (e) {
      setActionError(walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vault"
    >
      {/* fixed, not absolute — the veil must not scroll away with content */}
      <div className="fixed inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-auto w-full max-w-sm" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassPanel hairline className="p-6">
          <button
            onClick={onClose}
            aria-label="Close vault"
            className="absolute right-4 top-4 z-10 rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-ink/50 hover:text-ink"
          >
            ×
          </button>

          <p className="text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Vault — your escrow, always yours
          </p>

          {/* ── the balance ── */}
          <p className="numeric mt-5 text-4xl font-light text-ink">
            {balance === null ? '—' : formatUSDC(balance)}
            <span className="pl-2 text-base text-ink-muted">USDC</span>
          </p>
          <p className="mt-1.5 text-[11px] font-light text-ink-muted">
            always yours — withdraw anytime, to the cent.
          </p>

          {/* ── what it's covering ── */}
          <dl className="mt-5 border-t border-line">
            {[
              { label: 'Active plans', value: stats.activePlans },
              { label: 'Monthly total', value: stats.monthlyTotal },
              { label: 'Next charge', value: stats.nextCharge },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">{s.label}</dt>
                <dd className="numeric text-xs text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>

          {done ? (
            /* ── the receipt — same document as the wallet's Send ── */
            <div className="mt-6">
              <TxReceiptCard
                title={done.kind === 'deposit' ? 'added to vault' : 'withdrawn'}
                receipt={done.receipt}
                rows={[
                  { label: 'Amount', value: `${formatUSDC(done.receipt.amount)} USDC` },
                  {
                    label: done.kind === 'deposit' ? 'From your wallet' : 'From the vault',
                    value: done.kind === 'deposit' ? (address ?? '—') : 'Recurra vault escrow',
                    breakAll: true,
                  },
                  {
                    label: done.kind === 'deposit' ? 'To the vault' : 'To your wallet',
                    value: done.receipt.to,
                    breakAll: true,
                  },
                ]}
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setDone(null)}
                  className="flex-1 rounded-full border border-line px-5 py-2.5 text-sm text-ink-muted transition hover:border-ink/40 hover:text-ink"
                >
                  Another move
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : confirmingRiskyWithdraw ? (
            /* ── the warning — never a block, always a choice ── */
            <div className="mt-6">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Before you withdraw
              </p>
              <p className="text-[12px] font-light leading-relaxed text-ink-muted">
                This leaves less than your{' '}
                <span className="numeric text-ink">{stats.monthlyTotal}</span> monthly total —
                your next charge may fail until you fund it again. Your escrow, your call.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setConfirmingRiskyWithdraw(false)}
                  className="flex-1 rounded-full border border-line px-5 py-2.5 text-sm text-ink-muted transition hover:border-ink/40 hover:text-ink"
                >
                  Keep it funded
                </button>
                <button
                  onClick={() => run('withdraw')}
                  className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
                >
                  Withdraw anyway
                </button>
              </div>
            </div>
          ) : (
            /* ── the move — one amount, two directions ── */
            <div className="mt-6">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Move funds
              </p>
              <div className="mb-3 flex gap-2">
                <div className="flex w-full items-center gap-2 rounded-xl border border-line bg-canvas/60 px-4 py-3 transition focus-within:border-ink/40">
                  <input
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (actionError) setActionError(null);
                      if (confirmingRiskyWithdraw) setConfirmingRiskyWithdraw(false);
                    }}
                    disabled={busy !== null}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="numeric w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
                  />
                  <span className="numeric shrink-0 text-xs text-ink-faint">USDC</span>
                </div>
                <button
                  onClick={() => balance !== null && setAmount(formatUSDC(balance))}
                  disabled={busy !== null || balance === null || balance === 0n}
                  title="Everything in the vault — for withdrawing it all"
                  className="shrink-0 rounded-xl border border-line px-4 text-[11px] tracking-[0.08em] text-ink-muted transition hover:border-ink/40 hover:text-ink disabled:opacity-50"
                >
                  Max
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => run('deposit')}
                  disabled={!canAct}
                  title={disabledReason}
                  className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold tracking-[0.02em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)] disabled:opacity-40 disabled:hover:shadow-none"
                >
                  {busy === 'deposit' ? 'Signing…' : '+ Add funds'}
                </button>
                <button
                  onClick={() => run('withdraw')}
                  disabled={!canAct}
                  title={disabledReason}
                  className="flex-1 rounded-full border border-ink/30 bg-canvas/40 px-5 py-2.5 text-sm tracking-[0.02em] text-ink transition hover:border-ink/60 disabled:opacity-40"
                >
                  {busy === 'withdraw' ? 'Signing…' : 'Withdraw'}
                </button>
              </div>

              {isDevWallet && (
                <button
                  onClick={handleFaucet}
                  disabled={busy !== null || !address}
                  className="mt-3 text-[11px] text-ink-faint underline decoration-dotted underline-offset-2 transition hover:text-ink disabled:opacity-40"
                >
                  {busy === 'mint' ? 'Minting…' : 'dev faucet: mint 100 mUSDC'}
                </button>
              )}

              {actionError ? (
                <div className="mt-3">
                  <InlineError message={actionError} />
                </div>
              ) : (
                amount.length === 0 && (
                  <p className="mt-3 text-center text-[11px] font-light text-ink-faint">
                    enter an amount, then choose a direction — both end in a receipt.
                  </p>
                )
              )}
            </div>
          )}

          {/* ── history — every completed vault move, always here, even
              after a subscription that funded it gets cancelled ── */}
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">History</p>
            {history === null && !historyError && <LoadingLine label="reading the chain…" />}
            {historyError && <InlineError message={historyError} />}
            {history !== null && history.length === 0 && (
              <p className="text-[11px] text-ink-faint">Nothing moved yet.</p>
            )}
            {history !== null && history.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {history.map(({ kind, receipt }) => (
                  <ReceiptListRow
                    key={receipt.hash}
                    title={HISTORY_TITLES[kind]}
                    amount={`${formatUSDC(receipt.amount)} USDC`}
                    counterparty={receipt.to}
                    receipt={receipt}
                  />
                ))}
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>,
    document.body,
  );
}
