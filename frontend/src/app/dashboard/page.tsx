'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { VaultHero, VaultModal } from '@/features/vault';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { cycleProgress, formatUSDC, intervalLabel, timeUntil } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

const PREVIEW_SIZE = 2;

// Section cards under the vault: an accent dot names the section's color,
// one big lead number carries the glance, mini rows fill in detail, and
// hover lifts the card with a soft glow in its own accent — alive like
// the landing's planets, not a static box.
function SectionCard({
  title,
  href,
  accent,
  lead,
  leadLabel,
  badge,
  children,
}: {
  title: string;
  href: string;
  accent: string; // CSS color — the section's hue
  lead: string;
  leadLabel: string;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <GlassCard
        hairline
        className="flex h-full flex-col p-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#282c39]"
        style={{ transitionProperty: 'transform, border-color, box-shadow' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">{title}</p>
          </div>
          <span className="numeric shrink-0 whitespace-nowrap text-[11px] text-ink-muted transition group-hover:text-ink">
            View all →
          </span>
        </div>
        {badge ? <div className="mt-2">{badge}</div> : null}

        <p className="numeric mt-4 text-2xl font-semibold text-ink">{lead}</p>
        <p className="text-[11px] text-ink-faint">{leadLabel}</p>

        {children ? <div className="mt-4">{children}</div> : null}
      </GlassCard>
    </Link>
  );
}

function PreviewBadge() {
  return (
    <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
      PREVIEW
    </span>
  );
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
  const latestReceipt = MOCK_RECEIPTS[0];

  return (
    <div className="mx-auto max-w-3xl px-6 pt-6 pb-10">
      {error && <p className="mb-2 text-center text-sm text-danger" style={{ animation: 'fadeUp 0.7s ease both' }}>{error}</p>}

      {/* ── the sun: the vault, centered, everything else beneath it ── */}
      <div className="flex justify-center" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <VaultHero onOpen={() => setVaultOpen(true)} />
      </div>

      {/* ── the sections, in orbit below ─────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" style={{ animation: 'fadeUp 0.7s ease both 0.15s' }}>
        <SectionCard
          title="Subscriptions"
          href="/dashboard/subscriptions"
          accent="var(--mint)"
          lead={loading ? '…' : String(active.length)}
          leadLabel="active"
        >
          {subsPreview.length > 0 && (
            <ul className="space-y-2">
              {subsPreview.map((sub) => {
                const plan = plans.get(sub.planId);
                const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
                return (
                  <li key={sub.id} className="flex items-center gap-3">
                    <CadenceRing progress={progress} size={26} strokeWidth={2} />
                    <p className="min-w-0 flex-1 truncate text-xs text-ink">
                      {plan ? `${formatUSDC(plan.amount)} USDC` : `Plan #${sub.planId}`}
                    </p>
                    <span className="numeric shrink-0 text-[11px] text-ink-muted">{timeUntil(sub.nextPaymentDue)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Discover"
          href="/dashboard/discover"
          accent="var(--violet-light)"
          lead={String(plans.size)}
          leadLabel="plans to explore"
        >
          {plansPreview.length > 0 && (
            <ul className="space-y-2">
              {plansPreview.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between text-xs">
                  <span className="numeric text-ink">{formatUSDC(plan.amount)} USDC</span>
                  <span className="text-ink-muted">/ {intervalLabel(plan.intervalSecs)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Activity"
          href="/dashboard/activity"
          accent="var(--violet)"
          lead={`${formatUSDC(latestReceipt.amount)}`}
          leadLabel="USDC — last payment"
          badge={<PreviewBadge />}
        />
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
