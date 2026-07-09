'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlanDetailModal, useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { GlassCard } from '@/components/GlassCard';
import { MerchantMark } from '@/components/MerchantMark';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';

const MONTH_SECS = 2_592_000;

// Discover — plans grouped under their merchant, each merchant wearing a
// deterministic planet mark (same address, same planet, everywhere). The
// chain has no plan names, so the cards lead with what it does know:
// price, cadence, and a per-month equivalent so a weekly plan and a
// monthly plan compare at a glance.
//
// Two sides: plans you're already subscribed to (re-subscribing would
// just revert AlreadySubscribed) get their own section pointing at
// Subscriptions to manage them, separate from the rest to actually browse.
export default function DiscoverPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);

  const { subscriptions } = useSubscriptions(address);
  const subscribedPlanIds = new Set(subscriptions.filter((s) => s.active).map((s) => s.planId));

  useEffect(() => {
    api.plans
      .list()
      .then(setPlans)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const yourPlans = plans.filter((p) => subscribedPlanIds.has(p.id));
  const otherPlans = plans.filter((p) => !subscribedPlanIds.has(p.id));

  // group by merchant, insertion-ordered
  const byMerchant = new Map<string, Plan[]>();
  for (const p of otherPlans) {
    const list = byMerchant.get(p.merchant) ?? [];
    list.push(p);
    byMerchant.set(p.merchant, list);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      <p
        className="numeric mb-8 text-[11px] uppercase tracking-[0.24em] text-ink-faint"
        style={{ animation: 'fadeUp 0.7s ease both' }}
      >
        Discover
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center">
          <p className="text-sm text-ink-muted">No plans yet.</p>
        </div>
      )}

      {/* ── side one: what you're already on ─────────────────── */}
      {yourPlans.length > 0 && (
        <section className="mb-10" style={{ animation: 'fadeUp 0.7s ease both' }}>
          <p className="numeric mb-4 text-[11px] uppercase tracking-[0.2em] text-mint">
            Your subscriptions
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {yourPlans.map((plan) => {
              const isMonthly = plan.intervalSecs === MONTH_SECS;
              return (
                <GlassCard key={plan.id} hairline className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <MerchantMark address={plan.merchant} size={30} />
                      <div>
                        <p className="numeric text-2xl font-semibold text-ink">
                          {formatUSDC(plan.amount)}
                          <span className="ml-1.5 text-sm font-normal text-ink-muted">USDC</span>
                        </p>
                        <p className="numeric text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                          every {intervalLabel(plan.intervalSecs)}{!isMonthly && ` · plan #${plan.id}`}
                        </p>
                      </div>
                    </div>
                    <span className="numeric shrink-0 rounded-full border border-mint/40 bg-mint-deep px-2.5 py-1 text-[10px] text-mint">
                      subscribed
                    </span>
                  </div>

                  <Link
                    href="/dashboard/subscriptions"
                    className="mt-4 block w-full rounded-lg border border-line px-4 py-2.5 text-center text-sm text-ink transition hover:border-[#282c39]"
                  >
                    Manage in Subscriptions →
                  </Link>
                </GlassCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ── side two: what's left to browse (only needs its own label
          once side one exists — otherwise the page eyebrow already says
          "Discover") ───────────────────────────────────────────────── */}
      {yourPlans.length > 0 && otherPlans.length > 0 && (
        <p className="numeric mb-4 text-[11px] uppercase tracking-[0.2em] text-ink-faint">Discover more</p>
      )}

      <div className="space-y-10" style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}>
        {Array.from(byMerchant.entries()).map(([merchant, merchantPlans]) => (
          <section key={merchant}>
            {/* merchant header — the planet is the identity */}
            <div className="mb-4 flex items-center gap-3">
              <MerchantMark address={merchant} size={30} />
              <div>
                <p className="numeric text-sm text-ink">{shortAddress(merchant)}</p>
                <p className="numeric text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  merchant · {merchantPlans.length} plan{merchantPlans.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {merchantPlans.map((plan) => {
                const monthly = monthlyEquivalent(plan.amount, plan.intervalSecs);
                const isMonthly = plan.intervalSecs === MONTH_SECS;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelected(plan)}
                    aria-haspopup="dialog"
                    className="block text-left"
                  >
                  <GlassCard
                    hairline
                    className="group h-full p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#282c39]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="numeric text-2xl font-semibold text-ink">
                          {formatUSDC(plan.amount)}
                          <span className="ml-1.5 text-sm font-normal text-ink-muted">USDC</span>
                        </p>
                        <p className="numeric mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                          every {intervalLabel(plan.intervalSecs)}
                        </p>
                      </div>
                      <span className="numeric shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] text-ink-faint">
                        plan #{plan.id}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                      {!isMonthly && (
                        <p className="text-[11px] text-ink-muted">
                          ≈ <span className="numeric text-ink">{formatUSDC(monthly)} USDC</span> / month
                        </p>
                      )}
                      <p className="text-[11px] text-ink-faint">
                        max exposure: one cycle = {formatUSDC(plan.amount)} USDC
                      </p>
                    </div>

                    {/* span, not button — this whole card is already a
                        button; the real Subscribe action lives in the modal */}
                    <span className="mt-4 block w-full rounded-lg bg-mint px-4 py-2.5 text-center text-sm font-medium text-canvas transition group-hover:brightness-110">
                      View & subscribe →
                    </span>
                  </GlassCard>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <PlanDetailModal plan={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
