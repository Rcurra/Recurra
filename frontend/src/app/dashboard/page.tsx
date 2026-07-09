'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { cycleProgress, formatUSDC, intervalLabel, timeUntil } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

const PREVIEW_SIZE = 2;

// Every teaser card below the vault shares this shape: a label, a "View
// all," and a short preview — the same pattern Overview repeats for each
// section instead of dumping full lists inline.
function OverviewCard({
  title,
  href,
  badge,
  children,
}: {
  title: string;
  href: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">{title}</p>
          {badge}
        </div>
        <Link href={href} className="numeric shrink-0 whitespace-nowrap text-[11px] text-ink-muted transition hover:text-ink">
          View all →
        </Link>
      </div>
      {children}
    </section>
  );
}

function PreviewBadge() {
  return (
    <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
      PREVIEW
    </span>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-muted">{children}</p>;
}

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
  const subsPreview = [...active]
    .sort((a, b) => a.nextPaymentDue.getTime() - b.nextPaymentDue.getTime())
    .slice(0, PREVIEW_SIZE);
  const plansPreview = Array.from(plans.values()).slice(0, PREVIEW_SIZE);
  const receiptsPreview = MOCK_RECEIPTS.slice(0, PREVIEW_SIZE);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* ── the vault — first and biggest, but the same card language
          as everything below it, not a separate hero treatment ───── */}
      <p className="numeric mb-3 text-[11px] uppercase tracking-[0.2em] text-ink-faint">Your vault</p>
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface p-6">
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
            { label: 'Active plans', value: loading ? '…' : String(active.length) },
            { label: 'Monthly total', value: loading ? '…' : `${formatUSDC(monthly)} USDC` },
            { label: 'Next charge', value: loading ? '…' : nextDue ? timeUntil(nextDue.nextPaymentDue) : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-surface-2 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-faint">{s.label}</p>
              <p className="numeric mt-1 text-sm text-ink">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {/* ── every other section, as cards ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <OverviewCard title="Subs" href="/dashboard/subscriptions">
          {!loading && subsPreview.length === 0 && <EmptyRow>Nothing recurring yet.</EmptyRow>}
          <ul className="space-y-2">
            {subsPreview.map((sub) => {
              const plan = plans.get(sub.planId);
              const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
              return (
                <li key={sub.id} className="flex items-center gap-3">
                  <CadenceRing progress={progress} size={26} strokeWidth={2} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ink">
                      {plan ? `${formatUSDC(plan.amount)} USDC` : `Plan #${sub.planId}`}
                    </p>
                  </div>
                  <span className="numeric shrink-0 text-[11px] text-ink-muted">{timeUntil(sub.nextPaymentDue)}</span>
                </li>
              );
            })}
          </ul>
        </OverviewCard>

        <OverviewCard title="Discover" href="/dashboard/discover">
          {plansPreview.length === 0 && <EmptyRow>No plans yet.</EmptyRow>}
          <ul className="space-y-2">
            {plansPreview.map((plan) => (
              <li key={plan.id} className="flex items-center justify-between text-xs">
                <span className="numeric text-ink">{formatUSDC(plan.amount)} USDC</span>
                <span className="text-ink-muted">/ {intervalLabel(plan.intervalSecs)}</span>
              </li>
            ))}
          </ul>
        </OverviewCard>

        <OverviewCard title="Activity" href="/dashboard/activity" badge={<PreviewBadge />}>
          <ul className="space-y-2">
            {receiptsPreview.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs">
                <span className="numeric text-ink">{formatUSDC(r.amount)} USDC</span>
                <span className="text-ink-muted">paid</span>
              </li>
            ))}
          </ul>
        </OverviewCard>
      </div>
    </div>
  );
}
