'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlanDetailModal, useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { GlassPanel } from '@/components/GlassPanel';
import { LoadingLine } from '@/components/LoadingLine';
import { MerchantMark } from '@/components/MerchantMark';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';

// Discover — one glass panel per merchant, plans as quiet rows inside it
// (a catalog reads like a ledger, not an app store). The merchant's
// deterministic planet mark is the identity; each row leads with what
// the chain actually knows: price, cadence, per-month equivalent, max
// exposure. The row itself is the button — no white slabs shouting
// "subscribe" four times per screen; the modal holds the real action.
//
// Two sides: plans you're already on (re-subscribing would just revert
// AlreadySubscribed) get a compact strip pointing at Subscriptions,
// separate from what's actually browsable.
export default function DiscoverPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);

  const { subscriptions, refetch } = useSubscriptions(address);
  const subscribedPlanIds = new Set(subscriptions.filter((s) => s.active).map((s) => s.planId));

  useEffect(() => {
    api.plans
      .list()
      .then(setPlans)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const yourPlans = plans.filter((p) => subscribedPlanIds.has(p.id));
  // Browsable-only: a deactivated plan can't accept new subscribe() calls
  // (PlanNotActive) — but a plan you already hold stays visible above even
  // if the merchant deactivates it later; you still need to manage it.
  const otherPlans = plans.filter((p) => !subscribedPlanIds.has(p.id) && p.active);

  // group by merchant, insertion-ordered
  const byMerchant = new Map<string, Plan[]>();
  for (const p of otherPlans) {
    const list = byMerchant.get(p.merchant) ?? [];
    list.push(p);
    byMerchant.set(p.merchant, list);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      <div className="mb-8" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <h1
          className="text-lg text-ink"
          style={{ fontFamily: 'var(--font-display), sans-serif', letterSpacing: '0.08em' }}
        >
          Discover
        </h1>
        <p className="mt-1.5 text-[11px] font-light tracking-[0.06em] text-ink-muted">
          every plan the chain knows — subscribe once, it runs itself
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading && !error && <LoadingLine label="loading plans…" />}

      {!loading && !error && plans.length === 0 && (
        <GlassPanel className="p-12 text-center">
          <p className="text-sm text-ink-muted">No plans yet.</p>
        </GlassPanel>
      )}

      {/* ── what you're already on — a quiet strip, not a storefront ── */}
      {yourPlans.length > 0 && (
        <section className="mb-8" style={{ animation: 'fadeUp 0.7s ease both' }}>
          <GlassPanel className="px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">On your vault</p>
                {yourPlans.map((plan) => (
                  <span key={plan.id} className="flex items-center gap-2">
                    <MerchantMark address={plan.merchant} size={18} />
                    <span className="numeric text-xs text-ink">
                      {formatUSDC(plan.amount)}
                      <span className="text-ink-faint"> / {intervalLabel(plan.intervalSecs)}</span>
                    </span>
                  </span>
                ))}
              </div>
              <Link
                href="/dashboard/subscriptions"
                className="text-[11px] tracking-[0.08em] text-ink-muted transition hover:text-ink"
              >
                Manage →
              </Link>
            </div>
          </GlassPanel>
        </section>
      )}

      {/* ── the catalog — one panel per merchant, plans as rows ── */}
      <div className="space-y-6" style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}>
        {Array.from(byMerchant.entries()).map(([merchant, merchantPlans]) => (
          <GlassPanel key={merchant} hairline>
            {/* merchant header — the planet is the identity */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4">
              <MerchantMark address={merchant} size={34} />
              <div>
                <p className="numeric text-sm text-ink">{shortAddress(merchant)}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  merchant · {merchantPlans.length} plan{merchantPlans.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* column headers — the instrument-panel move that makes the
                rows scannable: every number sits in a lane, so the eye can
                run straight down "what does this cost per month" */}
            <div className="hidden border-t border-line px-6 py-2 sm:grid sm:grid-cols-[1.2fr_0.9fr_1fr_1.1fr_auto] sm:gap-x-6">
              {['Price', 'Every', '≈ per month', 'Max exposure', ''].map((h, i) => (
                <span key={i} className="text-[9px] uppercase tracking-[0.18em] text-ink-faint">
                  {h}
                </span>
              ))}
            </div>

            <ul>
              {[...merchantPlans]
                .sort(
                  (a, b) =>
                    Number(monthlyEquivalent(a.amount, a.intervalSecs)) -
                    Number(monthlyEquivalent(b.amount, b.intervalSecs)),
                )
                .map((plan) => {
                  const monthly = monthlyEquivalent(plan.amount, plan.intervalSecs);
                  return (
                    <li key={plan.id} className="border-t border-line">
                      <button
                        onClick={() => setSelected(plan)}
                        aria-haspopup="dialog"
                        className="group flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-4 text-left transition hover:bg-ink/[0.04] sm:grid sm:grid-cols-[1.2fr_0.9fr_1fr_1.1fr_auto]"
                      >
                        <span className="numeric text-lg leading-none text-ink">
                          {formatUSDC(plan.amount)}
                          <span className="pl-1.5 text-[10px] text-ink-faint">USDC</span>
                        </span>
                        <span className="numeric self-center text-[11px] text-ink-muted">
                          {intervalLabel(plan.intervalSecs)}
                        </span>
                        <span className="numeric self-center text-[11px] text-ink-muted">
                          {formatUSDC(monthly)} USDC
                        </span>
                        <span className="numeric self-center text-[11px] text-ink-faint">
                          {formatUSDC(plan.amount)} USDC / cycle
                        </span>
                        <span className="self-center text-[11px] tracking-[0.08em] text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink">
                          Subscribe →
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </GlassPanel>
        ))}
      </div>

      <PlanDetailModal plan={selected} onClose={() => setSelected(null)} onSubscribed={refetch} />
    </div>
  );
}
