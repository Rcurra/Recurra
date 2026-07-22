'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '@/components/GlassPanel';
import { InlineError } from '@/components/InlineError';
import { MerchantMark } from '@/components/MerchantMark';
import { TxReceiptCard } from '@/components/TxReceiptCard';
import { useAuth } from '@/features/auth';
import type { PaymentHealth, Plan } from '@/types';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';
import { walletErrorMessage, type TxReceipt } from '@/lib/wallet';
import { subscribeAndFund } from '@/lib/zerodev';

const MONTH_SECS = 2_592_000;
const RUNWAY_OPTIONS = [3, 6, 12] as const;

type Phase = 'idle' | 'signing' | 'done' | 'error';

// One plan, open — a single centered column in the login card's anatomy
// (the calmest card in the app, so the money moment borrows its manners):
// the merchant's planet with its pulse rings, the amount as the headline,
// the terms as a plain list, the runway choice, one sentence of truth,
// one button. F4: subscribe + approve + deposit batch into one
// gas-sponsored UserOperation via ZeroDev's Kernel account — genuinely
// one signature now, not a step counter standing in for three.
export function PlanDetailModal({
  plan,
  paymentHealth,
  onClose,
  onSubscribed,
}: {
  plan: Plan | null;
  paymentHealth?: PaymentHealth | null;
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
  return (
    <PlanDetailContent
      key={plan.id}
      plan={plan}
      paymentHealth={paymentHealth}
      onClose={onClose}
      onSubscribed={onSubscribed}
    />
  );
}

function PlanDetailContent({
  plan,
  paymentHealth,
  onClose,
  onSubscribed,
}: {
  plan: Plan;
  paymentHealth?: PaymentHealth | null;
  onClose: () => void;
  onSubscribed?: () => void;
}) {
  const { address } = useAuth();
  const [months, setMonths] = useState<(typeof RUNWAY_OPTIONS)[number]>(3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [subId, setSubId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<TxReceipt | null>(null);

  const monthly = monthlyEquivalent(plan.amount, plan.intervalSecs);
  const isMonthly = plan.intervalSecs === MONTH_SECS;
  const runwayTarget = monthly * BigInt(months);
  // The plan's own per-cycle amount is a hard floor on the funding target.
  // "N months of monthly-equivalent" undershoots badly for any plan whose
  // cadence is longer than N months — e.g. a 365-day plan's "3 months of
  // runway" is ~11 USDC against a real 45 USDC charge. Found live
  // 2026-07-17: a subscription funded below its own cycle amount sits
  // there forever, the scheduler correctly refusing every tick
  // (InsufficientVaultBalance) with nothing in the UI explaining why
  // "your first charge fires today" never actually happened.
  const fundAmount = runwayTarget > plan.amount ? runwayTarget : plan.amount;
  const runwayUndershootsOneCycle = fundAmount > runwayTarget;
  const signing = phase === 'signing';

  async function handleSubscribe() {
    if (!address) return;
    setError(null);
    setPhase('signing');
    try {
      // One batched UserOp: subscribe + approve + deposit, atomically — no
      // partial-failure state to track (unlike the old sequential-tx path,
      // this either all lands or none of it does).
      const result = await subscribeAndFund(address, plan.id, fundAmount, plan.intervalSecs);
      setSubId(result.subId);
      setReceipt(result.receipt);
      setPhase('done');
      onSubscribed?.();
    } catch (e) {
      setError(walletErrorMessage(e));
      setPhase('error');
    }
  }

  const facts = [
    { label: 'Plan', value: `#${plan.id}` },
    { label: 'Cadence', value: `every ${intervalLabel(plan.intervalSecs)}` },
    ...(isMonthly ? [] : [{ label: 'Per month, roughly', value: `${formatUSDC(monthly)} USDC` }]),
    { label: 'Capped at', value: `${formatUSDC(plan.amount)} USDC / cycle` },
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
      {/* backdrop — click to close. FIXED, not absolute: inside a
          scrollable wrapper an absolute backdrop scrolls away with the
          content and exposes the page at the bottom (found live) */}
      <div className="fixed inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

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

          {phase === 'done' && receipt ? (
            /* ── the receipt — same document every money move in the app ends in ── */
            <div className="mt-5">
              <TxReceiptCard
                title="subscribed"
                receipt={receipt}
                rows={[
                  { label: 'Subscription', value: subId !== null ? `#${subId}` : '—' },
                  { label: 'Funded', value: `${formatUSDC(receipt.amount)} USDC` },
                  { label: 'To the vault', value: receipt.to, breakAll: true },
                ]}
              />
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
              >
                Done
              </button>
            </div>
          ) : (
            <>
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
                      disabled={signing}
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
                  Your vault will hold{' '}
                  <span className="numeric text-ink">{formatUSDC(fundAmount)} USDC</span>{' '}
                  — only topped up from your wallet if it doesn&apos;t already.{' '}
                  {runwayUndershootsOneCycle ? (
                    <>
                      Since this plan bills its full amount every {intervalLabel(plan.intervalSecs)},
                      that&apos;s one full cycle rather than your {months}-month selection — enough for
                      today&apos;s first charge to actually go through. You&apos;ll want to add more
                      before the one after that.
                    </>
                  ) : (
                    <>
                      Your first charge fires today, then you&apos;re covered for the next{' '}
                      <span className="numeric text-ink">{months} months</span> without adding more.
                    </>
                  )}{' '}
                  It stays yours — withdraw anytime. Recurra can only ever move{' '}
                  <span className="numeric text-ink">{formatUSDC(plan.amount)} USDC</span> every{' '}
                  {intervalLabel(plan.intervalSecs)} to {shortAddress(plan.merchant)}.
                </p>
              </div>

              {paymentHealth?.degraded && (
                <div
                  className="mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3"
                  style={{
                    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03))',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-ink"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.5)' }}
                  >
                    !
                  </span>
                  <p className="text-[11px] font-light leading-relaxed text-ink-muted">
                    {paymentHealth.message}
                  </p>
                </div>
              )}

              {/* ── the one action ── */}
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={handleSubscribe}
                  disabled={signing || !address}
                  className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold tracking-[0.04em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)] disabled:opacity-40 disabled:hover:shadow-none"
                >
                  {phase === 'error' ? 'Try again' : signing ? 'Signing…' : 'Subscribe'}
                </button>

                {signing && (
                  <p className="numeric text-center text-[11px] text-ink-faint">
                    Signing — setting up your schedule and funding your vault, in one signature
                  </p>
                )}
                {error && <InlineError message={error} />}
                {phase === 'idle' && !error && (
                  <p className="text-center text-[11px] font-light leading-relaxed text-ink-faint">
                    Subscribing sets up your schedule and deposits the amount above — both in this
                    one click, one signature. Cancel anytime.
                  </p>
                )}
              </div>
            </>
          )}
        </GlassPanel>
      </div>
    </div>,
    document.body,
  );
}
