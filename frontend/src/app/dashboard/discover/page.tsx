'use client';

import { useEffect, useState } from 'react';
import { PlanDetailModal } from '@/features/subscriptions';
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
export default function DiscoverPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);

  useEffect(() => {
    api.plans
      .list()
      .then(setPlans)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // group by merchant, insertion-ordered
  const byMerchant = new Map<string, Plan[]>();
  for (const p of plans) {
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
