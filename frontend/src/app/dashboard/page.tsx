'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { VaultCard, VaultModal } from '@/features/vault';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { cycleProgress, formatUSDC, intervalLabel, timeUntil } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

const PREVIEW_SIZE = 2;

// Every teaser card shares this shape: a label, a "View all," and a short
// preview — the same pattern Overview repeats for each section instead of
// dumping full lists inline.
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
    <GlassCard hairline className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">{title}</p>
        <Link href={href} className="numeric shrink-0 whitespace-nowrap text-[11px] text-ink-muted transition hover:text-ink">
          View all →
        </Link>
      </div>
      {/* the badge gets its own line — a narrow card can't fit
          title + badge + link on one row without clipping */}
      {badge ? <div className="mt-2">{badge}</div> : null}
      <div className="mt-4">{children}</div>
    </GlassCard>
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
  const [vaultOpen, setVaultOpen] = useState(false);

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
      {error && <p className="mb-4 text-sm text-danger" style={{ animation: 'fadeUp 0.7s ease both' }}>{error}</p>}

      {/* ── every section as a card; the vault's door leads the grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <VaultCard onOpen={() => setVaultOpen(true)} />

        <OverviewCard title="Subscriptions" href="/dashboard/subscriptions">
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

      <VaultModal
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        stats={{
          activePlans: loading ? '…' : String(active.length),
          monthlyTotal: loading ? '…' : `${formatUSDC(monthly)} USDC`,
          nextCharge: loading ? '…' : nextDue ? timeUntil(nextDue.nextPaymentDue) : '—',
        }}
      />
    </div>
  );
}
