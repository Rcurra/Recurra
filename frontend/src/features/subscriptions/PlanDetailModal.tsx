'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { MerchantMark } from '@/components/MerchantMark';
import { useAuth } from '@/features/auth';
import type { Plan } from '@/types';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';
import { subscribe, walletErrorMessage } from '@/lib/wallet';

const MONTH_SECS = 2_592_000;

// One plan, open — the merchant's planet center stage, the numbers the
// chain actually knows, and what subscribing means: fund once, sign once,
// bounded exposure forever. The runway slider (F3's three-beat flow) is
// still ahead — this signs the subscribe() call directly, one signature.
export function PlanDetailModal({
  plan,
  onClose,
  onSubscribed,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSubscribed?: () => void;
}) {
  const open = plan !== null;

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

  if (!plan) return null;

  // Keyed by plan id so subscribe/error state resets on a fresh plan
  // instead of a set-state-in-effect to clear it.
  return <PlanDetailContent key={plan.id} plan={plan} onClose={onClose} onSubscribed={onSubscribed} />;
}

function PlanDetailContent({
  plan,
  onClose,
  onSubscribed,
}: {
  plan: Plan;
  onClose: () => void;
  onSubscribed?: () => void;
}) {
  const { address } = useAuth();
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const monthly = monthlyEquivalent(plan.amount, plan.intervalSecs);
  const isMonthly = plan.intervalSecs === MONTH_SECS;

  async function handleSubscribe() {
    if (!address) return;
    setSubscribing(true);
    setSubscribeError(null);
    try {
      await subscribe(address, plan.id);
      onSubscribed?.();
      onClose();
    } catch (e) {
      setSubscribeError(walletErrorMessage(e));
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Plan details"
    >
      {/* backdrop — click to close */}
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassCard hairline className="max-h-[85vh] overflow-y-auto p-8">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-danger/40 hover:text-danger"
          >
            ×
          </button>

          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[auto_1fr]">
            {/* ── the merchant, center stage ───────────────────── */}
            <div className="flex flex-col items-center text-center sm:pr-2">
              <div className="relative flex items-center justify-center" style={{ width: 150, height: 150 }}>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border border-violet/30"
                    style={{ animation: `shellWave ${7 + i * 3}s ease-out infinite ${i * 2.4}s` }}
                  />
                ))}
                <MerchantMark address={plan.merchant} size={110} />
              </div>

              <p className="numeric mt-4 text-sm text-ink">{shortAddress(plan.merchant)}</p>
              <p className="numeric mt-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint">merchant</p>

              <p className="numeric mt-5 text-3xl font-semibold leading-none text-ink">
                {formatUSDC(plan.amount)}
              </p>
              <p className="numeric mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                USDC / {intervalLabel(plan.intervalSecs)}
              </p>
            </div>

            {/* ── the terms, plainly ───────────────────────────── */}
            <div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {(() => {
                  const facts = [
                    { label: 'Plan', value: `#${plan.id}` },
                    { label: 'Cadence', value: `every ${intervalLabel(plan.intervalSecs)}` },
                    ...(isMonthly ? [] : [{ label: '≈ per month', value: `${formatUSDC(monthly)} USDC` }]),
                    { label: 'Max exposure', value: `${formatUSDC(plan.amount)} USDC / cycle` },
                  ];
                  return facts.map((f, i) => (
                    <div
                      key={f.label}
                      // odd count: the last fact spans the full row, no dead cell
                      className={`bg-surface-2 px-4 py-3 ${i === facts.length - 1 && facts.length % 2 === 1 ? 'col-span-2' : ''}`}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-ink-faint">{f.label}</p>
                      <p className="numeric mt-1 text-sm text-ink">{f.value}</p>
                    </div>
                  ));
                })()}
              </div>

              {/* what subscribing means — the pitch, kept honest: this
                  button only signs the schedule, it moves no money (that's
                  a separate trip to the vault) */}
              <div className="mt-5 space-y-2.5">
                {[
                  { n: '1', text: 'Sign once — this sets up the schedule. No money moves yet.' },
                  { n: '2', text: 'Fund your vault whenever — from Overview, before the next charge is due.' },
                  { n: '3', text: 'From then on, payments run themselves — the contract verifies every one.' },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3">
                    <span className="numeric mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[10px] text-ink-faint">
                      {s.n}
                    </span>
                    <p className="text-xs leading-relaxed text-ink-muted">{s.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing || !address}
                  className="w-full rounded-lg bg-mint px-5 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-40"
                >
                  {subscribing ? 'Signing…' : 'Subscribe'}
                </button>
                {subscribeError ? (
                  <p className="text-[11px] text-danger">{subscribeError}</p>
                ) : (
                  <p className="text-[11px] text-ink-faint">
                    cancel anytime — your worst case is ever only one cycle
                  </p>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
