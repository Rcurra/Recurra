'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { InlineError } from '@/components/InlineError';
import { formatUSDC, parseUSDC, shortAddress, timeAgo } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';
import { approveAndDeposit, mintTestUsdc, walletErrorMessage, withdraw } from '@/lib/wallet';
import { VaultDoor } from './VaultDoor';

// The faucet is a dev/testnet-only escape hatch (MockUSDC.mint() is open
// to anyone) — same flag the dev-signer path already gates on, so it can
// never appear pointed at a real deploy.
const isDevWallet = process.env.NEXT_PUBLIC_DEV_WALLET === '1';

// The open vault. Funds, actions, the stat strip, and what moved through
// Recurra this session — everything the card deliberately keeps behind
// the door. Stats come in as props; the page already computes them.
// Landscape, matching PlanDetailModal/SubDetailModal: the door center
// stage on the left, the paperwork (input, actions, stats) on the right.
export function VaultModal({
  open,
  onClose,
  address,
  balance,
  onChanged,
  stats,
}: {
  open: boolean;
  onClose: () => void;
  address: string | null;
  balance: bigint | null;
  onChanged: () => void;
  stats: { activePlans: string; monthlyTotal: string; nextCharge: string };
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

  return <VaultModalContent onClose={onClose} address={address} balance={balance} onChanged={onChanged} stats={stats} />;
}

function VaultModalContent({
  onClose,
  address,
  balance,
  onChanged,
  stats,
}: {
  onClose: () => void;
  address: string | null;
  balance: bigint | null;
  onChanged: () => void;
  stats: { activePlans: string; monthlyTotal: string; nextCharge: string };
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | 'mint' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const amountUnits = parseUSDC(amount);
  const amountInvalid = amount.length > 0 && amountUnits === null;
  const canAct = address !== null && amountUnits !== null && amountUnits > 0n && busy === null;
  const disabledReason = !address ? 'Not logged in' : amount.length === 0 ? 'Enter an amount above' : amountInvalid ? 'Enter a valid amount' : undefined;

  async function handleDeposit() {
    if (!address || amountUnits === null) return;
    setBusy('deposit');
    setActionError(null);
    try {
      await approveAndDeposit(address, amountUnits);
      setAmount('');
      onChanged();
    } catch (e) {
      setActionError(walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  // Clears on success, same as deposit — safe now that a disabled button
  // always says why (title + the caption below), instead of silently
  // doing nothing the way it did the first time a real user hit this.
  async function handleWithdraw() {
    if (!address || amountUnits === null) return;
    setBusy('withdraw');
    setActionError(null);
    try {
      await withdraw(address, amountUnits);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vault"
    >
      {/* backdrop — click to close */}
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassCard hairline className="max-h-[85vh] overflow-y-auto p-8">
          <button
            onClick={onClose}
            aria-label="Close vault"
            className="absolute right-4 top-4 z-10 rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-danger/40 hover:text-danger"
          >
            ×
          </button>

          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[auto_1fr]">
            {/* ── the door, center stage ───────────────────────── */}
            <div className="flex flex-col items-center text-center sm:pr-2">
              <div className="relative flex items-center justify-center" style={{ width: 150, height: 150 }}>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border border-mint/30"
                    style={{ animation: `shellWave ${7 + i * 3}s ease-out infinite ${i * 2.4}s` }}
                  />
                ))}
                <VaultDoor size={110} />
              </div>

              {balance === null ? (
                <p className="numeric mt-5 text-3xl font-semibold leading-none text-ink">
                  —<span className="text-base text-ink-faint">.——</span>
                </p>
              ) : (
                <p className="numeric mt-5 text-3xl font-semibold leading-none text-ink">
                  {formatUSDC(balance).split('.')[0]}
                  <span className="text-base text-ink-faint">.{formatUSDC(balance).split('.')[1]}</span>
                </p>
              )}
              <p className="numeric mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-faint">USDC escrow</p>
              <p className="mt-3 text-[11px] text-ink-muted">always yours — withdraw anytime</p>
            </div>

            {/* ── the paperwork ────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas/40 px-3 py-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="numeric w-full bg-transparent text-lg text-ink outline-none placeholder:text-ink-faint"
                />
                <span className="numeric shrink-0 text-xs text-ink-faint">USDC</span>
              </div>

              <div className="mt-3 flex gap-2.5">
                <button
                  onClick={handleDeposit}
                  disabled={!canAct}
                  title={disabledReason}
                  className="rounded-lg bg-mint px-5 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-40"
                >
                  {busy === 'deposit' ? 'Signing…' : '+ Add funds'}
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={!canAct}
                  title={disabledReason}
                  className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition disabled:opacity-40"
                >
                  {busy === 'withdraw' ? 'Signing…' : 'Withdraw anytime'}
                </button>
              </div>

              {isDevWallet && (
                <button
                  onClick={handleFaucet}
                  disabled={busy !== null || !address}
                  className="mt-2.5 text-[11px] text-ink-faint underline decoration-dotted underline-offset-2 transition hover:text-ink disabled:opacity-40"
                >
                  {busy === 'mint' ? 'Minting…' : 'dev faucet: mint 100 mUSDC'}
                </button>
              )}

              {actionError ? (
                <div className="mt-2">
                  <InlineError message={actionError} />
                </div>
              ) : (
                amount.length === 0 && (
                  <p className="mt-2 text-[11px] text-ink-faint">enter an amount to add funds or withdraw</p>
                )
              )}

              {/* stat strip */}
              <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {[
                  { label: 'Active plans', value: stats.activePlans },
                  { label: 'Monthly total', value: stats.monthlyTotal },
                  { label: 'Next charge', value: stats.nextCharge },
                ].map((s) => (
                  <div key={s.label} className="bg-surface-2 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">{s.label}</p>
                    <p className="numeric mt-1 text-sm text-ink">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* session activity — full width beneath, too dense for the side column */}
          <div className="mt-6 border-t border-line pt-6">
            <div className="mb-3 flex items-center gap-2">
              <p className="numeric text-[10px] uppercase tracking-[0.24em] text-ink-faint">Session activity</p>
              <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
                PREVIEW
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOCK_RECEIPTS.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/40 px-4 py-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 6px var(--mint)' }} />
                  <p className="numeric min-w-0 flex-1 truncate text-xs text-ink">
                    {formatUSDC(r.amount)} USDC
                    <span className="text-ink-faint"> → {shortAddress(r.merchant)}</span>
                  </p>
                  <span className="numeric shrink-0 text-[11px] text-ink-muted">{timeAgo(r.paidAt)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-faint">
              Sample rows — live session events arrive with F5 history.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
