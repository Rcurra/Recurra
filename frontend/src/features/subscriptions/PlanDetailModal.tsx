'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { MerchantMark } from '@/components/MerchantMark';
import { useAuth } from '@/features/auth';
import type { Plan } from '@/types';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';
import { approveAndDeposit, subscribe, walletErrorMessage } from '@/lib/wallet';

const MONTH_SECS = 2_592_000;
const RUNWAY_OPTIONS = [3, 6, 12] as const;

type Phase = 'idle' | 'subscribe' | 'approve' | 'deposit' | 'done' | 'error';

// One plan, open — the merchant's planet center stage, the numbers the
// chain actually knows, and the real three beats: pick plan (already
// done, by opening this) -> set runway -> sign. F3 is dev-mode direct
// writes, so "one signature" is still 2-3 real ones here (subscribe,
// approve, deposit) -- F4's ZeroDev batching is what actually collapses
// them into one UserOp. The step counter below is that stub, honestly.
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

  // Keyed by plan id so all of this resets on a fresh plan instead of a
  // set-state-in-effect to clear it.
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
  const [months, setMonths] = useState<(typeof RUNWAY_OPTIONS)[number]>(3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  // Tracked so a retry after a funding failure doesn't call subscribe()
  // again -- that would revert AlreadySubscribed since it already went
  // through.
  const [subId, setSubId] = useState<number | null>(null);

  const monthly = monthlyEquivalent(plan.amount, plan.intervalSecs);
  const isMonthly = plan.intervalSecs === MONTH_SECS;
  const fundAmount = monthly * BigInt(months);
  const signing = phase === 'subscribe' || phase === 'approve' || phase === 'deposit';

  async function handleSubscribe() {
    if (!address) return;
    setError(null);
    try {
      let currentSubId = subId;
      if (currentSubId === null) {
        setPhase('subscribe');
        currentSubId = await subscribe(address, plan.id);
        setSubId(currentSubId);
      }
      await approveAndDeposit(address, fundAmount, setPhase);
      setPhase('done');
      onSubscribed?.();
      setTimeout(onClose, 1100);
    } catch (e) {
      setError(walletErrorMessage(e));
      setPhase('error');
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

              {/* ── the runway — how much goes in, said plainly ─── */}
              <div className="mt-5">
                <p className="numeric mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  Fund your vault for
                </p>
                <div className="flex gap-2">
                  {RUNWAY_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMonths(m)}
                      disabled={signing || phase === 'done'}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
                        months === m
                          ? 'border-mint/50 bg-mint-deep text-mint'
                          : 'border-line text-ink-muted hover:text-ink'
                      }`}
                    >
                      {m} months
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  <span className="numeric text-ink">{formatUSDC(fundAmount)} USDC</span> goes into your
                  vault. It stays yours — withdraw anytime. Recurra can only ever move{' '}
                  <span className="numeric text-ink">{formatUSDC(plan.amount)} USDC</span> every{' '}
                  {intervalLabel(plan.intervalSecs)} to {shortAddress(plan.merchant)}.
                </p>
              </div>

              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  onClick={handleSubscribe}
                  disabled={signing || phase === 'done' || !address}
                  className="w-full rounded-lg bg-mint px-5 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-40"
                >
                  {phase === 'done'
                    ? 'Signed ✓'
                    : phase === 'error'
                      ? 'Try again'
                      : phase === 'idle'
                        ? 'Subscribe'
                        : 'Signing…'}
                </button>

                {signing && (
                  <p className="numeric text-[11px] text-ink-faint">
                    {phase === 'subscribe' && 'Step 1 of 3 — setting up your schedule'}
                    {phase === 'approve' && 'Step 2 of 3 — approving your vault'}
                    {phase === 'deposit' && 'Step 3 of 3 — funding your vault'}
                  </p>
                )}
                {phase === 'done' && (
                  <p className="numeric text-[11px] text-mint">
                    {formatUSDC(fundAmount)} USDC is in your vault.
                  </p>
                )}
                {error && <p className="text-[11px] text-danger">{error}</p>}
                {phase === 'idle' && !error && (
                  <p className="text-[11px] text-ink-faint">
                    cancel anytime — your worst case is ever only one cycle · 3 signatures for now, 1 once
                    account abstraction lands
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
