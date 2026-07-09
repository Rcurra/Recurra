'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
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

  const { subscriptions, loading, error } = useSubscriptions(address);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {});
  }, []);

  // Two subscription states only — the contracts don't have a "finished"
  // subscription, just active (renews every cycle) and cancelled
  // (unsubscribe()'d).
  const active = subscriptions.filter((s) => s.active);
  const cancelled = subscriptions.filter((s) => !s.active);
  const shown = filter === 'active' ? active : cancelled;

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
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
                <GlassCard
                  key={sub.id}
                  hairline={sub.active}
                  className={`flex flex-col items-center p-6 text-center transition-all duration-300 hover:-translate-y-1 ${
                    sub.active ? 'hover:shadow-[0_0_32px_-14px_var(--mint)]' : 'opacity-70'
                  }`}
                >
                  {/* the ring is the face — amount lives inside it */}
                  <div className="relative">
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
