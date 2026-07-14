'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { CadenceRing } from '@/components/CadenceRing';
import { InlineError } from '@/components/InlineError';
import { LoadingLine } from '@/components/LoadingLine';
import { TxReceiptCard } from '@/components/TxReceiptCard';
import { useAuth } from '@/features/auth';
import type { Plan, Subscription } from '@/types';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress } from '@/lib/format';
import { getSubscriptionReceipts, type SubscriptionReceipt } from '@/lib/receipts';
import { unsubscribe, walletErrorMessage } from '@/lib/wallet';

const RECEIPT_TITLES: Record<SubscriptionReceipt['kind'], string> = {
  subscribed: 'subscribed & funded',
  charged: 'charged',
  cancelled: 'cancelled',
};

// The live countdown — the pulse made visible. Ticks every second toward
// nextPaymentDue; this is real chain state, not decoration.
function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ms = target.getTime() - now;
  if (ms <= 0) return { due: true, text: 'due now' };

  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86_400);
  const hh = String(Math.floor((s % 86_400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return { due: false, text: days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}` };
}

// One subscription, open — its ring center-stage with the atmosphere
// shells, the countdown ticking underneath, the cycle drawn as a line.
export function SubDetailModal({
  sub,
  plan,
  onClose,
  onCancelled,
}: {
  sub: Subscription | null;
  plan: Plan | null;
  onClose: () => void;
  onCancelled?: () => void;
}) {
  const open = sub !== null;

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

  if (!sub) return null;

  // Keyed by sub id so switching subscriptions resets receipts/cancel state
  // via remount instead of a manual reset inside an effect.
  return <SubDetailContent key={sub.id} sub={sub} plan={plan} onClose={onClose} onCancelled={onCancelled} />;
}

// Split so the countdown hook only runs while a subscription is open.
function SubDetailContent({
  sub,
  plan,
  onClose,
  onCancelled,
}: {
  sub: Subscription;
  plan: Plan | null;
  onClose: () => void;
  onCancelled?: () => void;
}) {
  const countdown = useCountdown(sub.nextPaymentDue);
  const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
  const { address } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<SubscriptionReceipt[] | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSubscriptionReceipts(sub.id)
      .then((r) => {
        if (!cancelled) setReceipts(r);
      })
      .catch((e) => {
        if (!cancelled) setReceiptsError(walletErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sub.id]);

  async function handleCancel() {
    if (!address) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await unsubscribe(address, sub.id);
      onCancelled?.();
      onClose();
    } catch (e) {
      setCancelError(walletErrorMessage(e));
      setConfirming(false);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Subscription details"
    >
      {/* backdrop — click to close */}
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassCard hairline className="max-h-[85vh] overflow-y-auto p-8">
          {/* close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-danger/40 hover:text-danger"
          >
            ×
          </button>

          {/* landscape: the stage on the left, the paperwork on the right */}
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[auto_1fr]">
            {/* ── the cadence, center stage ───────────────────── */}
            <div className="flex flex-col items-center text-center sm:pr-2">
              <div className="relative" style={{ width: 176, height: 176 }}>
                {/* atmosphere shells — the pulse, expanding off the ring */}
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border border-mint/30"
                    style={{ animation: `shellWave ${7 + i * 3}s ease-out infinite ${i * 2.4}s` }}
                  />
                ))}
                <CadenceRing progress={sub.active ? progress : 0} size={176} strokeWidth={4} breathing={sub.active} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="numeric text-3xl font-semibold leading-none text-ink">
                    {plan ? formatUSDC(plan.amount) : `#${sub.planId}`}
                  </p>
                  <p className="numeric mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    USDC {plan && `/ ${intervalLabel(plan.intervalSecs)}`}
                  </p>
                </div>
              </div>

              {/* the countdown — alive */}
              <p className="numeric mt-6 text-[10px] uppercase tracking-[0.28em] text-ink-faint">Next charge</p>
              <p
                className={`numeric mt-2 text-2xl font-semibold tracking-wide ${
                  countdown.due ? 'breathe text-mint' : 'text-ink'
                }`}
              >
                {sub.active ? countdown.text : '—'}
              </p>
            </div>

            {/* ── the paperwork ───────────────────────────────── */}
            <div>
              {/* the cycle, drawn as a line */}
              {sub.active && (
                <div className="mb-6">
                  <div className="relative h-px w-full bg-line">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${progress * 100}%`,
                        background: 'linear-gradient(90deg, var(--mint), var(--violet))',
                      }}
                    />
                    <span
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-mint"
                      style={{ left: `calc(${progress * 100}% - 5px)`, boxShadow: '0 0 8px var(--mint)' }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="numeric text-[9px] uppercase tracking-[0.16em] text-ink-faint">charged</span>
                    <span className="numeric text-[9px] uppercase tracking-[0.16em] text-ink-faint">due</span>
                  </div>
                </div>
              )}

              {/* the facts */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {[
                  { label: 'Merchant', value: plan ? shortAddress(plan.merchant) : '—' },
                  { label: 'Plan', value: `#${sub.planId}` },
                  { label: 'Max exposure', value: plan ? `${formatUSDC(plan.amount)} USDC` : '—' },
                  { label: 'Status', value: sub.active ? 'Active' : 'Cancelled' },
                ].map((f) => (
                  <div key={f.label} className="bg-surface-2 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">{f.label}</p>
                    <p className="numeric mt-1 text-sm text-ink">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* the receipts — the whole lifetime of this subscription
                  (subscribed & funded, every charge, cancellation), each
                  one the same document Wallet/Vault writes end in. Stays
                  here after cancelling — history, not a live status. */}
              <div className="mt-5">
                <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Receipts</p>
                {receipts === null && !receiptsError && <LoadingLine label="reading the chain…" />}
                {receiptsError && <InlineError message={receiptsError} />}
                {receipts !== null && receipts.length === 0 && (
                  <p className="text-[11px] text-ink-faint">Nothing on-chain for this subscription yet.</p>
                )}
                {receipts !== null && receipts.length > 0 && (
                  <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
                    {receipts.map(({ kind, receipt }) => (
                      <TxReceiptCard
                        key={receipt.hash}
                        title={RECEIPT_TITLES[kind]}
                        receipt={receipt}
                        rows={
                          kind === 'cancelled'
                            ? []
                            : [
                                { label: kind === 'subscribed' ? 'Funded' : 'Amount', value: `${formatUSDC(receipt.amount)} USDC` },
                                { label: kind === 'subscribed' ? 'To the vault' : 'Paid to', value: receipt.to, breakAll: true },
                              ]
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* the way out — always visible, per the invariant */}
              {sub.active && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  {confirming ? (
                    <div className="flex w-full gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="flex-1 rounded-lg bg-danger px-5 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-40"
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        disabled={cancelling}
                        className="flex-1 rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition disabled:opacity-40"
                      >
                        Nevermind
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(true)}
                      className="w-full rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition hover:border-danger/40 hover:text-danger"
                    >
                      Cancel subscription
                    </button>
                  )}
                  {cancelError ? (
                    <InlineError message={cancelError} />
                  ) : (
                    <p className="text-[11px] text-ink-faint">
                      your escrow stays yours — withdraw anytime, even mid-cycle
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
