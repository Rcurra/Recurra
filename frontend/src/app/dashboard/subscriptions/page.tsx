'use client';

import { useEffect, useState } from 'react';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { cycleProgress, formatUSDC, intervalLabel, timeUntil } from '@/lib/format';

type Tab = 'active' | 'cancelled';

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

  // Two states only — the contracts don't have a "finished" subscription,
  // just active (renews every cycle) and cancelled (unsubscribe()'d).
  const active = subscriptions.filter((s) => s.active);
  const cancelled = subscriptions.filter((s) => !s.active);
  const shown = tab === 'active' ? active : cancelled;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2" style={{ animation: 'fadeUp 0.7s ease both' }}>
        {(
          [
            { key: 'active', label: `Active (${active.length})` },
            { key: 'cancelled', label: `Cancelled (${cancelled.length})` },
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

      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && shown.length === 0 && (
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
