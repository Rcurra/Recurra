'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SubDetailModal, useSubscriptions } from '@/features/subscriptions';
import type { Subscription } from '@/types';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { LoadingLine } from '@/components/LoadingLine';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress, timeAgo, timeUntil } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

type Filter = 'active' | 'cancelled';

// useSearchParams needs a Suspense boundary above it (Next requirement);
// the page is the boundary, the view is the content.
export default function SubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionsView />
    </Suspense>
  );
}

function SubscriptionsView() {
  const { address } = useAuth();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [filter, setFilter] = useState<Filter>('active');
  // Activity is not a third state — it's a takeover panel, toggled from
  // the opposite corner. The old /dashboard/activity route deep-links it
  // open via ?tab=activity (read from the router's params, not
  // window.location — a client-side redirect can mount this component
  // before the window URL updates).
  const [activityOpen, setActivityOpen] = useState(searchParams.get('tab') === 'activity');
  const [selected, setSelected] = useState<Subscription | null>(null);

  const { subscriptions, loading, error, refetch } = useSubscriptions(address);
  // The charge moment: nextPaymentDue advancing between polls IS a payment
  // having fired (markPaid runs right before debit) -- whatever triggers
  // executePayment (a terminal cast call today, Henry's scheduler once it
  // lands), this detection doesn't change.
  const prevDueRef = useRef<Map<number, number>>(new Map());
  const [justCharged, setJustCharged] = useState<Set<number>>(new Set());
  const [chargeToasts, setChargeToasts] = useState<{ id: number; sub: Subscription }[]>([]);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const prev = prevDueRef.current;
    const next = new Map<number, number>();
    const charged: Subscription[] = [];
    for (const s of subscriptions) {
      const dueMs = s.nextPaymentDue.getTime();
      next.set(s.id, dueMs);
      const prevMs = prev.get(s.id);
      if (prevMs !== undefined && dueMs > prevMs) charged.push(s);
    }
    prevDueRef.current = next;
    if (charged.length === 0) return;

    // Deferred a tick (react-hooks/set-state-in-effect) -- same reasoning
    // as useSubscriptions' nonce-refetch: don't call setState synchronously
    // inside the effect body.
    setTimeout(() => {
      setJustCharged((old) => {
        const merged = new Set(old);
        charged.forEach((s) => merged.add(s.id));
        return merged;
      });
      charged.forEach((s) => {
        const toastId = Date.now() + s.id;
        setChargeToasts((old) => [...old, { id: toastId, sub: s }]);
        setTimeout(() => {
          setChargeToasts((old) => old.filter((t) => t.id !== toastId));
        }, 5000);
      });
    }, 0);

    charged.forEach((s) => {
      setTimeout(() => {
        setJustCharged((old) => {
          const copy = new Set(old);
          copy.delete(s.id);
          return copy;
        });
      }, 4500);
    });
  }, [subscriptions]);

  // Two subscription states only — the contracts don't have a "finished"
  // subscription, just active (renews every cycle) and cancelled
  // (unsubscribe()'d).
  const active = subscriptions.filter((s) => s.active);
  const cancelled = subscriptions.filter((s) => !s.active);
  const shown = filter === 'active' ? active : cancelled;

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      {/* ── the pulse, given a body: a charge just fired ────────── */}
      {chargeToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
          {chargeToasts.map((t) => {
            const plan = plans.get(t.sub.planId);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-mint/40 bg-surface/90 px-4 py-3 shadow-[0_0_20px_-8px_var(--mint)] backdrop-blur-xl"
                style={{ animation: 'fadeUp 0.35s ease both' }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 8px var(--mint)' }} />
                <p className="numeric text-xs text-ink">
                  Charged {plan ? `${formatUSDC(plan.amount)} USDC` : 'a payment'}
                  {plan && <span className="text-ink-muted"> → {shortAddress(plan.merchant)}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* header row: state filters left, activity apart on the right */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <div className="flex items-center gap-2">
          {(
            [
              { key: 'active', label: `Active (${active.length})` },
              { key: 'cancelled', label: `Cancelled (${cancelled.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`numeric rounded-full px-4 py-2 text-xs tracking-[0.04em] transition ${
                filter === t.key && !activityOpen
                  ? 'border border-mint/40 bg-mint-deep text-mint'
                  : 'border border-line text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setActivityOpen((o) => !o)}
          className={`numeric flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.04em] transition ${
            activityOpen
              ? 'border border-violet/50 bg-violet/15 text-violet-light'
              : 'border border-line text-ink-muted hover:text-ink'
          }`}
          aria-expanded={activityOpen}
        >
          Activity
          <svg
            width="9"
            height="6"
            viewBox="0 0 9 6"
            className={`transition-transform duration-300 ${activityOpen ? 'rotate-180' : ''}`}
          >
            <path d="M1 1 L4.5 4.5 L8 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── activity takeover ─────────────────────────────────── */}
      {activityOpen && (
        <div style={{ animation: 'fadeUp 0.45s ease both' }}>
          <div className="mb-4 flex items-center gap-2">
            <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
              PREVIEW
            </span>
            <p className="text-xs text-ink-faint">sample receipts — real history arrives with F5</p>
          </div>
          <ul className="space-y-3">
            {MOCK_RECEIPTS.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-5 rounded-2xl border border-line bg-surface/75 p-5 backdrop-blur-xl"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 8px var(--mint)' }} />
                <div className="min-w-0 flex-1">
                  <p className="numeric text-[15px] font-medium text-ink">{formatUSDC(r.amount)} USDC</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    paid to <span className="numeric">{shortAddress(r.merchant)}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="numeric text-xs text-ink-muted">{timeAgo(r.paidAt)}</p>
                  <p
                    title="Arrives with F5 — real receipts link to Arbiscan"
                    className="numeric mt-1 cursor-not-allowed text-[11px] text-ink-faint opacity-60"
                  >
                    {r.txHash}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── the cadences — each subscription wears its ring ───── */}
      {!activityOpen && (
        <>
          {error && <p className="mb-4 text-sm text-danger">{error}</p>}

          {loading && !error && <LoadingLine label="loading subscriptions…" />}

          {!loading && !error && shown.length === 0 && (
            <div
              className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center"
              style={{ animation: 'fadeUp 0.7s ease both 0.1s' }}
            >
              <p className="text-sm text-ink-muted">
                {filter === 'active' ? 'Nothing recurring yet.' : 'Nothing cancelled — good.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ animation: 'fadeUp 0.7s ease both 0.1s' }}>
            {shown.map((sub) => {
              const plan = plans.get(sub.planId);
              const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
              return (
                <button key={sub.id} onClick={() => setSelected(sub)} aria-haspopup="dialog" className="block text-left">
                <GlassCard
                  hairline={sub.active}
                  className={`flex h-full flex-col items-center p-6 text-center transition-all duration-700 hover:-translate-y-1 ${
                    justCharged.has(sub.id)
                      ? 'border-mint/60 shadow-[0_0_28px_-8px_var(--mint)]'
                      : sub.active
                        ? 'hover:shadow-[0_0_14px_-10px_var(--mint)]'
                        : 'opacity-70'
                  }`}
                >
                  {/* the ring is the face — amount lives inside it */}
                  <div className="relative">
                    {justCharged.has(sub.id) &&
                      [0, 1].map((i) => (
                        <div
                          key={i}
                          className="absolute inset-0 rounded-full border border-mint/50"
                          style={{ animation: `shellWave ${1.4 + i * 0.5}s ease-out ${i * 0.15}s` }}
                        />
                      ))}
                    <CadenceRing progress={sub.active ? progress : 0} size={104} strokeWidth={3.5} breathing={sub.active} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="numeric text-lg font-semibold leading-none text-ink">
                        {plan ? formatUSDC(plan.amount) : `#${sub.planId}`}
                      </p>
                      <p className="numeric mt-1 text-[9px] uppercase tracking-[0.14em] text-ink-faint">USDC</p>
                    </div>
                  </div>

                  <p className="numeric mt-4 text-xs text-ink-muted">
                    {plan ? `every ${intervalLabel(plan.intervalSecs)}` : 'plan details unavailable'}
                  </p>
                  {plan && (
                    <p className="numeric mt-1 text-[11px] text-ink-faint">to {shortAddress(plan.merchant)}</p>
                  )}

                  <div className="mt-4 w-full border-t border-line pt-3">
                    {sub.active ? (
                      <>
                        <p className="text-xs text-ink-muted">
                          next charge <span className="numeric text-ink">{timeUntil(sub.nextPaymentDue)}</span>
                        </p>
                        {plan && (
                          <p className="mt-1 text-[11px] text-ink-faint">
                            max exposure {formatUSDC(plan.amount)} USDC
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-ink-faint">cancelled — history kept</p>
                    )}
                  </div>
                </GlassCard>
                </button>
              );
            })}
          </div>
        </>
      )}

      <SubDetailModal
        sub={selected}
        plan={selected ? (plans.get(selected.planId) ?? null) : null}
        onClose={() => setSelected(null)}
        onCancelled={refetch}
      />
    </div>
  );
}
