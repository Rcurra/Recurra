'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '@/components/GlassPanel';
import { InlineError } from '@/components/InlineError';
import { LoadingLine } from '@/components/LoadingLine';
import { ReceiptListRow } from '@/components/ReceiptListRow';
import { useAuth } from '@/features/auth';
import type { Plan, Subscription } from '@/types';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress } from '@/lib/format';
import { getSubscriptionReceipts, type SubscriptionReceipt } from '@/lib/receipts';
import { unsubscribe } from '@/lib/zerodev';
import { walletErrorMessage } from '@/lib/wallet';

const RECEIPT_TITLES: Record<SubscriptionReceipt['kind'], string> = {
  subscribed: 'subscribed',
  charged: 'charged',
  cancelled: 'cancelled',
};

// The live countdown — real chain state, not decoration. Ticks every
// second toward nextPaymentDue. `enabled` gates the ticking itself, not
// just whether the text is shown — a cancelled or plan-retired subscription
// has no upcoming charge to count toward (a retired plan stops charging
// on-chain entirely), so ticking would be counting down to nothing.
// Frozen at whatever `now` was on mount instead.
function useCountdown(target: Date, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);

  const ms = target.getTime() - now;
  if (ms <= 0) return { due: true, text: 'due now' };

  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86_400);
  const hh = String(Math.floor((s % 86_400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return { due: false, text: days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}` };
}

// One subscription, open — rebuilt 2026-07-15 to match Wallet/Vault's
// anatomy exactly (single calm column: label, big number, plain subtext,
// hairline-row facts, receipts, one action) instead of the old two-column
// [ring | paperwork] split, which read as scattered next to those two.
// The atmosphere-shell "pulse" rings and the ring/countdown breathing are
// gone too — restraint over decoration, same rule CadenceRing itself is
// built on ("nothing decorative the architecture can't honor"); a static
// fill and a plain countdown already say everything true here.
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
  const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
  // Derived, not passed in — this modal is opened from several places
  // (Subscriptions' three tabs, Discover's "yours" rows) and shouldn't need
  // every caller to compute and thread this through. Same meaning as
  // SubscriptionCard's `unavailable`: still active on-chain, but the
  // merchant retired the plan, which stops charging entirely (isDue goes
  // false; the Executor refuses the charge).
  const unavailable = sub.active && plan !== null && !plan.active;
  const countdown = useCountdown(sub.nextPaymentDue, sub.active && !unavailable);
  const { address } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<SubscriptionReceipt[] | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  // Fetched quietly in the background either way (cheap, and the count
  // needs to be ready the moment the toggle appears) — but only RENDERED
  // once the user actually asks to see it. Found live 2026-07-15: showing
  // the full receipt cards unconditionally pushed Cancel off-screen and
  // read as clutter, not information — this should be something you go
  // looking for, not something that just shows up.
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSubscriptionReceipts(sub.id, sub.subscriber)
      .then((r) => {
        if (!cancelled) setReceipts(r);
      })
      .catch((e) => {
        if (!cancelled) setReceiptsError(walletErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sub.id, sub.subscriber]);

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

  const facts = [
    { label: 'Merchant', value: plan ? shortAddress(plan.merchant) : '—' },
    { label: 'Plan', value: `#${sub.planId}` },
    { label: 'Max exposure', value: plan ? `${formatUSDC(plan.amount)} USDC / cycle` : '—' },
    { label: 'Status', value: sub.active ? (unavailable ? 'Active — plan unavailable' : 'Active') : 'Cancelled' },
  ];

  // Portaled to <body>, fixed backdrop — this was the last modal in the
  // app still missing both fixes (z-50 inside the page's z-10 context
  // loses to the sticky z-20 header; an absolute backdrop scrolls away
  // inside a scrollable wrapper and exposes the page beneath).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Subscription details"
    >
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

          <p className="text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Subscription — {sub.active ? 'recurring' : 'cancelled'}
          </p>

          {/* ── the amount ── */}
          <p className="numeric mt-5 text-4xl font-light text-ink">
            {plan ? formatUSDC(plan.amount) : `#${sub.planId}`}
            <span className="pl-2 text-base text-ink-muted">
              USDC {plan && `/ ${intervalLabel(plan.intervalSecs)}`}
            </span>
          </p>
          <p className="mt-1.5 text-[11px] font-light text-ink-muted">
            {!sub.active
              ? 'no more charges — history kept below'
              : unavailable
                ? 'the merchant retired this plan — no more charges will be taken; your escrow stays yours'
                : (
                    <>
                      next charge <span className="numeric text-ink">{countdown.text}</span>
                    </>
                  )}
          </p>

          {/* the cycle, drawn as a line — the one animated element left,
              and it only ever moves with real progress. Hidden for
              plan-retired subs: there is no cycle in motion to draw. */}
          {sub.active && !unavailable && (
            <div className="mt-4">
              <div className="relative h-px w-full bg-line">
                <div
                  className="absolute inset-y-0 left-0 bg-ink"
                  style={{ width: `${progress * 100}%` }}
                />
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-ink"
                  style={{ left: `calc(${progress * 100}% - 4px)` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="numeric text-[9px] uppercase tracking-[0.16em] text-ink-faint">charged</span>
                <span className="numeric text-[9px] uppercase tracking-[0.16em] text-ink-faint">due</span>
              </div>
            </div>
          )}

          {/* ── the facts ── */}
          <dl className="mt-5 border-t border-line">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">{f.label}</dt>
                <dd className="numeric text-xs text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>

          {/* ── the receipts — the whole lifetime of this subscription
              (subscribed & funded, every charge, cancellation), each one
              the same document Wallet/Vault writes end in. Stays here
              after cancelling — history, not a live status. Collapsed by
              default: something you go looking for, not something that
              just shows up and crowds the modal. ── */}
          <button
            onClick={() => setReceiptsOpen((o) => !o)}
            className="mt-5 flex w-full items-center justify-between border-t border-line pt-4 text-left"
            aria-expanded={receiptsOpen}
          >
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Receipts{receipts !== null && ` (${receipts.length})`}
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
            <div className="mt-3">
              {receipts === null && !receiptsError && <LoadingLine label="reading the chain…" />}
              {receiptsError && <InlineError message={receiptsError} />}
              {receipts !== null && receipts.length === 0 && (
                <p className="text-[11px] text-ink-faint">Nothing on-chain for this subscription yet.</p>
              )}
              {receipts !== null && receipts.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {receipts.map(({ kind, receipt }) => (
                    <ReceiptListRow
                      key={receipt.hash}
                      title={RECEIPT_TITLES[kind]}
                      amount={kind === 'cancelled' ? undefined : `${formatUSDC(receipt.amount)} USDC`}
                      counterparty={kind === 'cancelled' ? undefined : receipt.to}
                      receipt={receipt}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── the way out — always visible, per the invariant ── */}
          {sub.active && (
            <div className="mt-5 flex flex-col items-center gap-2">
              {confirming ? (
                <div className="flex w-full gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition disabled:opacity-40"
                  >
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={cancelling}
                    className="flex-1 rounded-full border border-line px-5 py-2.5 text-sm text-ink-muted transition hover:border-ink/40 hover:text-ink disabled:opacity-40"
                  >
                    Nevermind
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="w-full rounded-full border border-line px-5 py-2.5 text-sm text-ink-muted transition hover:border-ink/40 hover:text-ink"
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
        </GlassPanel>
      </div>
    </div>,
    document.body,
  );
}
