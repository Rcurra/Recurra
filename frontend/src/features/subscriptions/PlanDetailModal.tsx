'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '@/components/GlassPanel';
import { InlineError } from '@/components/InlineError';
import { MerchantMark } from '@/components/MerchantMark';
import { useAuth } from '@/features/auth';
import type { Plan } from '@/types';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';
import { approveAndDeposit, subscribe, walletErrorMessage } from '@/lib/wallet';

const MONTH_SECS = 2_592_000;
const RUNWAY_OPTIONS = [3, 6, 12] as const;

type Phase = 'idle' | 'subscribe' | 'approve' | 'deposit' | 'done' | 'error';

// One plan, open — a single centered column in the login card's anatomy
// (the calmest card in the app, so the money moment borrows its manners):
// the merchant's planet with its pulse rings, the amount as the headline,
// the terms as a plain list, the runway choice, one sentence of truth,
// one button. F3 is dev-mode direct writes, so "one signature" is still
// 2-3 real ones here (subscribe, approve, deposit) — F4's ZeroDev
// batching is what actually collapses them. The step counter is that
// stub, honestly.
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
  // again — that would revert AlreadySubscribed since it already went
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

  const facts = [
    { label: 'Plan', value: `#${plan.id}` },
    { label: 'Cadence', value: `every ${intervalLabel(plan.intervalSecs)}` },
    ...(isMonthly ? [] : [{ label: 'Per month, roughly', value: `${formatUSDC(monthly)} USDC` }]),
    { label: 'Max exposure', value: `${formatUSDC(plan.amount)} USDC / cycle` },
  ];

  // Portaled to <body>: the page content lives inside a z-10 stacking
  // context, so a z-50 INSIDE it still loses to the sticky z-20 header —
  // found live with the nav pill rendering on top of this dialog.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Plan details"
    >
      {/* backdrop — click to close */}
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-auto w-full max-w-sm" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassPanel hairline className="p-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-ink/50 hover:text-ink"
          >
            ×
          </button>

          {/* ── the merchant, center stage ── */}
          <div className="flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center" style={{ width: 84, height: 84 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-full border border-ink/20"
                  style={{ animation: `shellWave ${7 + i * 3}s ease-out infinite ${i * 2.4}s` }}
                />
              ))}
              <MerchantMark address={plan.merchant} size={62} />
            </div>
            <p className="numeric mt-2 text-xs text-ink-muted">{shortAddress(plan.merchant)}</p>

            <p
              className="mt-3 text-xl text-ink"
              style={{ fontFamily: 'var(--font-display), sans-serif', letterSpacing: '0.04em' }}
            >
              {formatUSDC(plan.amount)}
              <span className="pl-2 text-sm text-ink-muted">USDC</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-ink-faint">
              every {intervalLabel(plan.intervalSecs)}
            </p>
          </div>

          {/* ── the terms, as a plain list ── */}
          <dl className="mt-5 border-t border-line">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">{f.label}</dt>
                <dd className="numeric text-xs text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>

          {/* ── the runway — how much goes in, said plainly ── */}
          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Fund your vault for
            </p>
            <div className="flex gap-2">
              {RUNWAY_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  disabled={signing || phase === 'done'}
                  className={`flex-1 rounded-full border px-3 py-2 text-xs tracking-[0.04em] transition disabled:opacity-50 ${
                    months === m
                      ? 'border-ink bg-ink font-semibold text-canvas'
                      : 'border-line text-ink-muted hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  {m} months
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-light leading-relaxed text-ink-muted">
              <span className="numeric text-ink">{formatUSDC(fundAmount)} USDC</span>{' '}
              goes into your vault — your first charge fires today, then you&apos;re covered for the
              next <span className="numeric text-ink">{months} months</span> without adding more. It
              stays yours — withdraw anytime. Recurra can only ever move{' '}
              <span className="numeric text-ink">{formatUSDC(plan.amount)} USDC</span> every{' '}
              {intervalLabel(plan.intervalSecs)} to {shortAddress(plan.merchant)}.
            </p>
          </div>

          {/* ── the one action ── */}
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={handleSubscribe}
              disabled={signing || phase === 'done' || !address}
              className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold tracking-[0.04em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)] disabled:opacity-40 disabled:hover:shadow-none"
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
              <p className="numeric text-center text-[11px] text-ink-faint">
                {phase === 'subscribe' && 'Step 1 of 3 — setting up your schedule'}
                {phase === 'approve' && 'Step 2 of 3 — approving your vault'}
                {phase === 'deposit' && 'Step 3 of 3 — funding your vault'}
              </p>
            )}
            {phase === 'done' && (
              <p className="numeric text-center text-[11px] text-ink-muted">
                {formatUSDC(fundAmount)} USDC is in your vault.
              </p>
            )}
            {error && (
              <>
                {subId !== null && (
                  <p className="text-center text-[11px] text-ink-faint">
                    Your schedule is already set up — only funding failed. Retrying will not create
                    a second subscription.
                  </p>
                )}
                <InlineError message={error} />
              </>
            )}
            {phase === 'idle' && !error && (
              <p className="text-center text-[11px] font-light leading-relaxed text-ink-faint">
                Subscribing sets up your schedule and deposits the amount above — both in this one
                click. Cancel anytime · 3 signatures for now, 1 once account abstraction lands.
              </p>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>,
    document.body,
  );
}
