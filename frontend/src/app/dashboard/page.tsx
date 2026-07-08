'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { cycleProgress, formatUSDC, intervalLabel, timeUntil } from '@/lib/format';

const HORIZON_SIZE = 3;

export default function OverviewPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());

  const { subscriptions, loading, error } = useSubscriptions(address);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {}); // cards degrade gracefully without plan detail
  }, []);

  const active = subscriptions.filter((s) => s.active);
  // monthly commitment across active subs — display math only
  const monthly = active.reduce((sum, s) => {
    const p = plans.get(s.planId);
    if (!p) return sum;
    return sum + (p.amount * 2_592_000n) / BigInt(Math.max(p.intervalSecs, 1));
  }, 0n);
  const nextDue = active.length
    ? active.reduce((a, b) => (a.nextPaymentDue < b.nextPaymentDue ? a : b))
    : null;
  const horizon = [...active]
    .sort((a, b) => a.nextPaymentDue.getTime() - b.nextPaymentDue.getTime())
    .slice(0, HORIZON_SIZE);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* ── the vault — hero object ─────────────────────────── */}
      <p className="numeric mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-faint">Your vault</p>
      <section className="relative mb-10 overflow-hidden rounded-2xl border border-line bg-surface p-6">
        {/* gradient hairline along the top edge */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--mint), var(--violet), transparent)' }}
        />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="numeric text-3xl font-semibold text-ink">
              —<span className="text-lg text-ink-faint">.—— USDC</span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              escrow balance — arrives with the balance API
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              disabled
              title="Arrives with F3 — writes go through your account"
              className="rounded-lg bg-mint px-5 py-2.5 text-sm font-medium text-canvas opacity-40"
            >
              + Add funds
            </button>
            <button
              disabled
              title="Arrives with F3 — always available, no questions asked"
              className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink opacity-40"
            >
              Withdraw anytime
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {[
            {
              label: 'Active plans',
              value: loading ? '…' : String(active.length),
            },
            {
              label: 'Monthly total',
              value: loading ? '…' : `${formatUSDC(monthly)} USDC`,
            },
            {
              label: 'Next charge',
              value: loading ? '…' : nextDue ? timeUntil(nextDue.nextPaymentDue) : '—',
            },
          ].map((s) => (
            <div key={s.label} className="bg-surface-2 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-faint">{s.label}</p>
              <p className="numeric mt-1 text-sm text-ink">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── horizon — a teaser, not the whole list ──────────── */}
      <div className="mb-3 flex items-center justify-between">
        <p className="numeric text-[11px] uppercase tracking-[0.24em] text-ink-faint">Coming up</p>
        <Link href="/dashboard/subscriptions" className="numeric text-[11px] text-ink-muted transition hover:text-ink">
          View all →
        </Link>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && horizon.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-10 text-center">
          <p className="text-sm text-ink-muted">Nothing recurring yet.</p>
          <p className="mt-1 text-xs text-ink-faint">
            <Link href="/dashboard/discover" className="text-mint hover:underline">
              Browse plans
            </Link>{' '}
            to set up your first one.
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {horizon.map((sub) => {
          const plan = plans.get(sub.planId);
          const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
          return (
            <li
              key={sub.id}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <CadenceRing progress={progress} size={32} strokeWidth={2.5} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {plan ? (
                    <>
                      <span className="numeric">{formatUSDC(plan.amount)} USDC</span>
                      <span className="text-ink-muted"> / {intervalLabel(plan.intervalSecs)}</span>
                    </>
                  ) : (
                    `Plan #${sub.planId}`
                  )}
                </p>
              </div>
              <span className="numeric shrink-0 text-xs text-ink-muted">{timeUntil(sub.nextPaymentDue)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
