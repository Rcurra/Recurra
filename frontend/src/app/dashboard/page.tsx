'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/features/subscriptions';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress, timeUntil } from '@/lib/format';

export default function DashboardPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());

  useEffect(() => {
    const addr = localStorage.getItem('recurra_address');
    if (!addr) {
      router.push('/');
      return;
    }
    setAddress(addr);
  }, [router]);

  const { subscriptions, loading, error } = useSubscriptions(address);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {}); // cards degrade gracefully without plan detail
  }, []);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-[0.25em] text-ink">RECURRA</span>
          {address && (
            <span className="numeric rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">
              {shortAddress(address)}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-lg font-medium text-ink">Your subscriptions</h1>
        <p className="mb-8 text-sm text-ink-muted">
          Charges run themselves. Your money stays yours until the moment each one lands.
        </p>

        {loading && <p className="text-sm text-ink-faint">Loading…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && subscriptions.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-sm text-ink-muted">Nothing recurring yet.</p>
            <p className="mt-1 text-xs text-ink-faint">Browse plans to set up your first one.</p>
          </div>
        )}

        <ul className="space-y-3">
          {subscriptions.map((sub) => {
            const plan = plans.get(sub.planId);
            const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
            return (
              <li
                key={sub.id}
                className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition hover:bg-surface-2"
              >
                <CadenceRing progress={sub.active ? progress : 0} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {plan ? (
                      <>
                        <span className="numeric">{formatUSDC(plan.amount)} USDC</span>
                        <span className="text-ink-muted"> / {intervalLabel(plan.intervalSecs)}</span>
                      </>
                    ) : (
                      `Plan #${sub.planId}`
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {sub.active ? (
                      <>
                        next charge <span className="numeric">{timeUntil(sub.nextPaymentDue)}</span>
                      </>
                    ) : (
                      'cancelled — history kept'
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    sub.active
                      ? 'bg-mint-deep text-mint'
                      : 'border border-line text-ink-faint'
                  }`}
                >
                  {sub.active ? 'Active' : 'Ended'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
