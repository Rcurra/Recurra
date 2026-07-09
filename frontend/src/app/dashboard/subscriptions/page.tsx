'use client';

import { useEffect, useState } from 'react';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress, timeAgo, timeUntil } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

// Activity is a view of this page, not its own route — the third tab
// takes over the list area with the payment history.
type Tab = 'active' | 'cancelled' | 'activity';

export default function SubscriptionsPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [tab, setTab] = useState<Tab>('active');

  const { subscriptions, loading, error } = useSubscriptions(address);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {});
  }, []);

  // Two subscription states only — the contracts don't have a "finished"
  // subscription, just active (renews every cycle) and cancelled
  // (unsubscribe()'d). Activity is the third view, not a third state.
  const active = subscriptions.filter((s) => s.active);
  const cancelled = subscriptions.filter((s) => !s.active);
  const shown = tab === 'active' ? active : tab === 'cancelled' ? cancelled : [];

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      <div className="mb-6 flex flex-wrap items-center gap-2" style={{ animation: 'fadeUp 0.7s ease both' }}>
        {(
          [
            { key: 'active', label: `Active (${active.length})` },
            { key: 'cancelled', label: `Cancelled (${cancelled.length})` },
            { key: 'activity', label: 'Activity' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`numeric rounded-full px-4 py-2 text-xs tracking-[0.04em] transition ${
              tab === t.key
                ? 'border border-mint/40 bg-mint-deep text-mint'
                : 'border border-line text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && tab !== 'activity' && <p className="text-sm text-danger">{error}</p>}

      {/* ── activity view — payment history takes over the list ── */}
      {tab === 'activity' && (
        <div style={{ animation: 'fadeUp 0.5s ease both' }}>
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

      {tab !== 'activity' && !loading && !error && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-10 text-center">
          <p className="text-sm text-ink-muted">
            {tab === 'active' ? 'Nothing recurring yet.' : 'Nothing cancelled — good.'}
          </p>
        </div>
      )}

      <ul className="space-y-3" style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}>
        {shown.map((sub) => {
          const plan = plans.get(sub.planId);
          const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
          return (
            <li
              key={sub.id}
              className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-line bg-surface/75 p-5 backdrop-blur-xl transition hover:border-[#282c39] hover:bg-surface-2"
            >
              <div className="relative">
                <CadenceRing progress={sub.active ? progress : 0} size={52} />
                {sub.active && (
                  <span
                    className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-mint"
                    style={{ boxShadow: '0 0 8px var(--mint)' }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {plan ? (
                    <>
                      <span className="numeric">{formatUSDC(plan.amount)} USDC</span>
                      <span className="text-ink-muted"> / {intervalLabel(plan.intervalSecs)}</span>
                    </>
                  ) : (
                    `Plan #${sub.planId}`
                  )}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {sub.active ? (
                    <>
                      next charge <span className="numeric text-ink-muted">{timeUntil(sub.nextPaymentDue)}</span>
                      {plan && (
                        <span className="text-ink-faint">
                          {' '}
                          · max exposure {formatUSDC(plan.amount)} USDC
                        </span>
                      )}
                    </>
                  ) : (
                    'cancelled — history kept'
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                  sub.active ? 'bg-mint-deep text-mint' : 'border border-line text-ink-faint'
                }`}
              >
                {sub.active ? 'Active' : 'Ended'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
