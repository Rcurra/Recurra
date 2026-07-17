'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PlanDetailModal, SubDetailModal, useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan, Subscription } from '@/types';
import { GlassPanel } from '@/components/GlassPanel';
import { LoadingLine } from '@/components/LoadingLine';
import { MerchantMark } from '@/components/MerchantMark';
import { formatUSDC, intervalLabel, monthlyEquivalent, shortAddress } from '@/lib/format';

// One ordering rule for the whole page — cheapest-per-month first — used
// by every section below (module-level so the local panel component can
// share it too, not just the page component).
function byMonthlyEquivalent(a: Plan, b: Plan): number {
  return Number(monthlyEquivalent(a.amount, a.intervalSecs)) - Number(monthlyEquivalent(b.amount, b.intervalSecs));
}

function groupByMerchant<T extends { merchant: string }>(list: T[]): Map<string, T[]> {
  const byMerchant = new Map<string, T[]>();
  for (const item of list) {
    const existing = byMerchant.get(item.merchant) ?? [];
    existing.push(item);
    byMerchant.set(item.merchant, existing);
  }
  return byMerchant;
}

// One row per plan, one visual shape shared by all three sections below —
// only what sits in the trailing action cell differs (a real button when
// there's something to do, a static tag when there's isn't). Whole row is
// the button when `onClick` is given, matching the catalog's original
// "the row itself is the button" rule.
function PlanRow({ plan, actionLabel, onClick }: { plan: Plan; actionLabel: string; onClick?: () => void }) {
  const monthly = monthlyEquivalent(plan.amount, plan.intervalSecs);
  const cells = (
    <>
      <span className="numeric text-lg leading-none text-ink">
        {formatUSDC(plan.amount)}
        <span className="pl-1.5 text-[10px] text-ink-faint">USDC</span>
      </span>
      <span className="numeric self-center text-[11px] text-ink-muted">{intervalLabel(plan.intervalSecs)}</span>
      <span className="numeric self-center text-[11px] text-ink-muted">{formatUSDC(monthly)} USDC</span>
      <span className="numeric self-center text-[11px] text-ink-faint">{formatUSDC(plan.amount)} USDC / cycle</span>
    </>
  );

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-canvas/30">
      {onClick ? (
        <button
          onClick={onClick}
          aria-haspopup="dialog"
          className="group flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-4 text-left transition hover:bg-ink/[0.04] sm:grid sm:grid-cols-[1.2fr_0.9fr_1fr_1.1fr_auto]"
        >
          {cells}
          {/* an invitation, not a disclosure — the chip fills white the
              moment the cursor considers it */}
          <span className="self-center rounded-full border border-line px-3.5 py-1.5 text-[11px] tracking-[0.06em] text-ink-muted transition group-hover:border-ink group-hover:bg-ink group-hover:font-semibold group-hover:text-canvas">
            {actionLabel}
          </span>
        </button>
      ) : (
        <div className="flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-4 text-left sm:grid sm:grid-cols-[1.2fr_0.9fr_1fr_1.1fr_auto]">
          {cells}
          <span className="self-center rounded-full border border-line px-3.5 py-1.5 text-[11px] tracking-[0.06em] text-ink-faint">
            {actionLabel}
          </span>
        </div>
      )}
    </li>
  );
}

function MerchantPanel({
  merchant,
  merchantPlans,
  renderRow,
  animationDelay,
  dim = false,
}: {
  merchant: string;
  merchantPlans: Plan[];
  renderRow: (plan: Plan) => ReactNode;
  animationDelay: number;
  dim?: boolean;
}) {
  return (
    <GlassPanel
      hairline
      className={dim ? 'opacity-60' : undefined}
      style={{ animation: `fadeUp 0.6s ease both ${animationDelay}s` }}
    >
      <div className="flex items-center gap-3 px-6 pt-5 pb-4">
        <MerchantMark address={merchant} size={34} />
        <div>
          <p className="numeric text-sm text-ink">{shortAddress(merchant)}</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            merchant · {merchantPlans.length} plan{merchantPlans.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="hidden border-t border-line px-6 py-2 sm:grid sm:grid-cols-[1.2fr_0.9fr_1fr_1.1fr_auto] sm:gap-x-6">
        {['Price', 'Every', '≈ per month', 'Capped at', ''].map((h, i) => (
          <span key={i} className="text-[9px] uppercase tracking-[0.18em] text-ink-faint">
            {h}
          </span>
        ))}
      </div>

      {/* each row its own bounded box with real air between them, not just
          a hairline divider — a continuous list read as one undifferentiated
          block, especially where a row's state (e.g. "no longer offered")
          needs to visually stand apart from its neighbors, not blend in */}
      <ul className="space-y-2 border-t border-line p-3">
        {[...merchantPlans].sort(byMonthlyEquivalent).map((plan) => renderRow(plan))}
      </ul>
    </GlassPanel>
  );
}

// Discover — one glass panel per merchant, plans as quiet rows inside it
// (a catalog reads like a ledger, not an app store — one visual language
// for "a plan," used by all three sections here, not a special card
// treatment for the ones you already hold). The merchant's deterministic
// planet mark is the identity; each row leads with what the chain actually
// knows: price, cadence, per-month equivalent, max exposure.
//
// Three real scopes: what you're already on (rows, opens the same
// manage/cancel modal Subscriptions uses), what you can actually
// subscribe to, and what the merchant has since pulled — visible for
// transparency, never clickable unless you hold it (subscribe() would
// revert PlanNotActive for anyone else).
export default function DiscoverPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  const { subscriptions, refetch } = useSubscriptions(address);
  const subscribedPlanIds = new Set(subscriptions.filter((s) => s.active).map((s) => s.planId));

  useEffect(() => {
    api.plans
      .list()
      .then(setPlans)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 1 — yours: active subscriptions, paired with their plan.
  const yourSubscriptions = subscriptions
    .filter((s) => s.active)
    .map((s) => ({ sub: s, plan: plans.find((p) => p.id === s.planId) ?? null }))
    .filter((x): x is { sub: Subscription; plan: Plan } => x.plan !== null);
  const yourPlansByMerchant = groupByMerchant(yourSubscriptions.map((x) => x.plan));
  const subByPlanId = new Map(yourSubscriptions.map((x) => [x.plan.id, x.sub]));

  // 2 — available: not subscribed, still accepting new subscribers.
  const availablePlans = plans.filter((p) => !subscribedPlanIds.has(p.id) && p.active);
  const availableByMerchant = groupByMerchant(availablePlans);

  // 3 — no longer offered: not subscribed, merchant deactivated it. Can
  // never be subscribed to (PlanNotActive) — shown for transparency only.
  // A plan you DO hold that's been deactivated stays in section 1 instead,
  // tagged accordingly there — you still need to manage it, so it belongs
  // with the rest of what's yours, not here.
  const unavailablePlans = plans.filter((p) => !subscribedPlanIds.has(p.id) && !p.active);
  const unavailableByMerchant = groupByMerchant(unavailablePlans);

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      <div className="mb-8" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <h1
          className="text-lg text-ink"
          style={{ fontFamily: 'var(--font-display), sans-serif', letterSpacing: '0.08em' }}
        >
          Discover
        </h1>
        <p className="mt-1.5 text-xs tracking-[0.06em] text-ink/85">
          subscribe once — payments run themselves, and the money stays yours
        </p>
        {/* the login card's trust bullets, promoted to the storefront —
            the selling point, bright enough to sell */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {['Cancel anytime', 'Withdraw anytime', 'Fees covered'].map((line) => (
            <span key={line} className="flex items-center gap-1.5 text-[11px] text-ink/85">
              <span className="h-1 w-1 rounded-full bg-ink" />
              {line}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading && !error && <LoadingLine label="loading plans…" />}

      {!loading && !error && plans.length === 0 && (
        <GlassPanel className="p-12 text-center">
          <p className="text-sm text-ink-muted">No plans yet.</p>
        </GlassPanel>
      )}

      {/* ── 1. yours — same row language as everything else on this
          page, opening the same manage/cancel modal Subscriptions does
          (never the Subscribe flow — you already hold these) ────── */}
      {yourPlansByMerchant.size > 0 && (
        <section className="mb-10">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Your subscriptions</p>
          <div className="space-y-6">
            {Array.from(yourPlansByMerchant.entries()).map(([merchant, merchantPlans], mi) => (
              <MerchantPanel
                key={merchant}
                merchant={merchant}
                merchantPlans={merchantPlans}
                animationDelay={mi * 0.12}
                renderRow={(plan) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    actionLabel={plan.active ? 'Manage →' : 'no longer offered — Manage →'}
                    onClick={() => setSelectedSub(subByPlanId.get(plan.id) ?? null)}
                  />
                )}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 2. available — the ledger, one panel per merchant ────── */}
      {availableByMerchant.size > 0 && (
        <section className="mb-10">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Available to subscribe</p>
          <div className="space-y-6">
            {Array.from(availableByMerchant.entries()).map(([merchant, merchantPlans], mi) => (
              <MerchantPanel
                key={merchant}
                merchant={merchant}
                merchantPlans={merchantPlans}
                animationDelay={0.12 + mi * 0.12}
                renderRow={(plan) => (
                  <PlanRow key={plan.id} plan={plan} actionLabel="Subscribe →" onClick={() => setSelectedPlan(plan)} />
                )}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 3. no longer offered — visible, never clickable ──────── */}
      {unavailableByMerchant.size > 0 && (
        <section>
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-ink-faint">No longer offered</p>
          <div className="space-y-6">
            {Array.from(unavailableByMerchant.entries()).map(([merchant, merchantPlans], mi) => (
              <MerchantPanel
                key={merchant}
                merchant={merchant}
                merchantPlans={merchantPlans}
                animationDelay={0.12 + mi * 0.12}
                dim
                renderRow={(plan) => <PlanRow key={plan.id} plan={plan} actionLabel="no longer offered" />}
              />
            ))}
          </div>
        </section>
      )}

      <PlanDetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} onSubscribed={refetch} />
      <SubDetailModal
        sub={selectedSub}
        plan={selectedSub ? (plans.find((p) => p.id === selectedSub.planId) ?? null) : null}
        onClose={() => setSelectedSub(null)}
        onCancelled={refetch}
      />
    </div>
  );
}
