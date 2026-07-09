'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { EscrowChart, VaultModal, VaultPanel } from '@/features/vault';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress, timeAgo, timeUntil } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

function PreviewBadge() {
  return (
    <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
      PREVIEW
    </span>
  );
}

// Bento overview — asymmetric panels, one gradient-elevated (the vault),
// the cadence rings doing sparkline duty in the subscriptions table, and
// an always-visible action rail. The reference density, in our universe.
export default function OverviewPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [vaultOpen, setVaultOpen] = useState(false);

  const { subscriptions, loading, error } = useSubscriptions(address);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {}); // panels degrade gracefully without plan detail
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
  const tableRows = [...active]
    .sort((a, b) => a.nextPaymentDue.getTime() - b.nextPaymentDue.getTime())
    .slice(0, 4);
  const latestReceipt = MOCK_RECEIPTS[0];

  return (
    <div className="mx-auto max-w-4xl px-6 pt-8 pb-10">
      {/* greeting */}
      <p className="numeric mb-4 text-sm text-ink-muted" style={{ animation: 'fadeUp 0.7s ease both' }}>
        Hi {address ? shortAddress(address) : 'there'} <span aria-hidden>👋</span>
      </p>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_215px] lg:grid-rows-[auto_auto]"
        style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}
      >
        {/* ── the vault — the one gradient panel ─────────────── */}
        <VaultPanel onOpen={() => setVaultOpen(true)} />

        {/* ── escrow over time ───────────────────────────────── */}
        <GlassCard hairline className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">Escrow over time</p>
            <PreviewBadge />
          </div>
          <EscrowChart />
        </GlassCard>

        {/* ── action rail — spans both rows on desktop ───────── */}
        <GlassCard hairline className="flex flex-col gap-3 p-5 lg:row-span-2">
          <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">Actions</p>

          <button
            disabled
            title="Arrives with F3 — writes go through your account"
            className="w-full rounded-lg bg-mint px-4 py-2.5 text-sm font-medium text-canvas opacity-40"
          >
            + Add funds
          </button>
          <button
            disabled
            title="Arrives with F3 — always available, no questions asked"
            className="w-full rounded-lg border border-line px-4 py-2.5 text-sm text-ink opacity-40"
          >
            Withdraw anytime
          </button>
          <Link
            href="/dashboard/discover"
            className="w-full rounded-lg border border-violet/50 px-4 py-2.5 text-center text-sm text-violet-light transition hover:border-violet hover:bg-violet/10"
          >
            Browse plans →
          </Link>

          {/* quick stats */}
          <div className="mt-2 space-y-2.5 border-t border-line pt-4">
            {[
              { label: 'Active plans', value: loading ? '…' : String(active.length) },
              { label: 'Monthly total', value: loading ? '…' : `${formatUSDC(monthly)} USDC` },
              { label: 'Next charge', value: loading ? '…' : nextDue ? timeUntil(nextDue.nextPaymentDue) : '—' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">{s.label}</p>
                <p className="numeric text-xs text-ink">{s.value}</p>
              </div>
            ))}
          </div>

          {/* last payment — activity teaser */}
          <Link href="/dashboard/activity" className="group mt-auto border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <p className="numeric text-[10px] uppercase tracking-[0.18em] text-ink-faint">Last payment</p>
              <PreviewBadge />
            </div>
            <p className="numeric mt-1.5 text-sm text-ink">
              {formatUSDC(latestReceipt.amount)} USDC
              <span className="text-ink-faint"> · {timeAgo(latestReceipt.paidAt)}</span>
            </p>
            <p className="numeric mt-1 text-[10px] text-ink-muted transition group-hover:text-ink">View activity →</p>
          </Link>
        </GlassCard>

        {/* ── subscriptions table — rings as sparklines ──────── */}
        <GlassCard hairline className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">Subscriptions</p>
            <Link href="/dashboard/subscriptions" className="numeric text-[11px] text-ink-muted transition hover:text-ink">
              View all →
            </Link>
          </div>

          {!loading && tableRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-canvas/30 p-8 text-center">
              <p className="text-sm text-ink-muted">Nothing recurring yet.</p>
              <p className="mt-1 text-xs text-ink-faint">
                <Link href="/dashboard/discover" className="text-mint hover:underline">
                  Browse plans
                </Link>{' '}
                to set up your first one.
              </p>
            </div>
          )}

          {tableRows.length > 0 && (
            <>
              {/* header row */}
              <div className="mb-2 grid grid-cols-[32px_1fr_1fr_auto] gap-3 px-1 sm:grid-cols-[32px_1fr_1fr_1fr_auto]">
                <span />
                <p className="numeric text-[9px] uppercase tracking-[0.16em] text-ink-faint">Plan</p>
                <p className="numeric hidden text-[9px] uppercase tracking-[0.16em] text-ink-faint sm:block">Merchant</p>
                <p className="numeric text-[9px] uppercase tracking-[0.16em] text-ink-faint">Next charge</p>
                <span />
              </div>
              <ul className="space-y-1.5">
                {tableRows.map((sub) => {
                  const plan = plans.get(sub.planId);
                  const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
                  return (
                    <li
                      key={sub.id}
                      className="grid grid-cols-[32px_1fr_1fr_auto] items-center gap-3 rounded-xl border border-line bg-canvas/30 px-1 py-2.5 transition hover:border-[#282c39] sm:grid-cols-[32px_1fr_1fr_1fr_auto]"
                    >
                      <CadenceRing progress={progress} size={26} strokeWidth={2} />
                      <p className="numeric truncate text-xs text-ink">
                        {plan ? (
                          <>
                            {formatUSDC(plan.amount)} USDC
                            <span className="text-ink-muted"> / {intervalLabel(plan.intervalSecs)}</span>
                          </>
                        ) : (
                          `Plan #${sub.planId}`
                        )}
                      </p>
                      <p className="numeric hidden truncate text-xs text-ink-muted sm:block">
                        {plan ? shortAddress(plan.merchant) : '—'}
                      </p>
                      <p className="numeric text-xs text-ink-muted">{timeUntil(sub.nextPaymentDue)}</p>
                      <span className="rounded-full bg-mint-deep px-2.5 py-0.5 text-[10px] text-mint">Active</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </GlassCard>
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
