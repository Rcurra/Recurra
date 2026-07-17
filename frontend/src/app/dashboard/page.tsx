'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { VaultHero, VaultModal } from '@/features/vault';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { LoadingLine } from '@/components/LoadingLine';
import { useChargeDetection } from '@/hooks/useChargeDetection';
import {
  cycleProgress,
  formatUSDC,
  intervalLabel,
  isPastDue,
  isUpcoming,
  monthlyEquivalent,
  runwayLabel,
  shortAddress,
  timeUntil,
} from '@/lib/format';
import { getVaultBalance } from '@/lib/wallet';

// Overview — the vault hero up top (balance, runway, the two permanent
// actions), the Subscriptions list right below it as the one real "see
// everything" surface (each row wears its own ring, real cycle progress).
export default function OverviewPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultBalance, setVaultBalance] = useState<bigint | null>(null);
  const [balanceNonce, setBalanceNonce] = useState(0);

  const { subscriptions, loading, error } = useSubscriptions(address);
  const { justCharged } = useChargeDetection(subscriptions);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {}); // panels degrade gracefully without plan detail
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getVaultBalance(address)
      .then((b) => {
        if (!cancelled) setVaultBalance(b);
      })
      .catch(() => {}); // reservoir card degrades gracefully without a balance
    return () => {
      cancelled = true;
    };
  }, [address, balanceNonce]);

  const refetchVaultBalance = useCallback(() => setBalanceNonce((n) => n + 1), []);

  // Background poll so the balance tick (the vault dropping when a charge
  // fires) shows up on its own, same as useSubscriptions' polling.
  useEffect(() => {
    if (!address) return;
    const id = setInterval(() => setBalanceNonce((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [address]);

  const active = subscriptions.filter((s) => s.active);
  // Only subs whose plan is still active actually charge — a merchant-retired
  // plan stops firing on-chain (isDue goes false, the Executor reverts), so
  // every money projection below must skip those or the runway would lie.
  // Same `?? true` convention as the Subscriptions page: a plan not yet
  // loaded reads as charging, no flash of wrong math before plans fetch.
  const charging = active.filter((s) => plans.get(s.planId)?.active ?? true);
  // monthly commitment across charging subs — display math only
  const monthly = charging.reduce((sum, s) => {
    const p = plans.get(s.planId);
    return p ? sum + monthlyEquivalent(p.amount, p.intervalSecs) : sum;
  }, 0n);
  const nextDue = charging.length
    ? charging.reduce((a, b) => (a.nextPaymentDue < b.nextPaymentDue ? a : b))
    : null;
  // Top 4 soonest-due — but a charge that just fired advances that sub's
  // nextPaymentDue a full interval, which usually knocks it straight out
  // of "soonest 4" in this same recompute. Pin anything still `justCharged`
  // into the list regardless of rank, or the glow below would have no row
  // left to animate — the moment it exists to show would already be gone.
  const soonestFour = [...charging]
    .sort((a, b) => a.nextPaymentDue.getTime() - b.nextPaymentDue.getTime())
    .slice(0, 4);
  const pinnedCharged = charging.filter(
    (s) => justCharged.has(s.id) && !soonestFour.some((r) => r.id === s.id),
  );
  const tableRows = [...pinnedCharged, ...soonestFour];

  // Under-funded warning — sub due but runway zero. Derived entirely from
  // data already on screen: due = nextPaymentDue has passed; can't-cover =
  // the pooled vault balance is short of that plan's per-cycle amount.
  // Nothing is lost if this sits unfunded a while — the charge just waits
  // (PaymentExecutor reverts InsufficientVaultBalance, markPaid never
  // runs) until funded, then goes through for the full amount.
  const underfunded =
    vaultBalance === null
      ? []
      : charging.filter((s) => {
          const plan = plans.get(s.planId);
          return plan && isPastDue(s.nextPaymentDue) && vaultBalance < plan.amount;
        });

  // Coming-up heads-up — fully-funded subs get advance notice too, not just
  // the ones at risk. Excludes anything already in `underfunded` so a single
  // sub never shows two competing banners at once.
  const underfundedIds = new Set(underfunded.map((s) => s.id));
  const upcoming = charging.filter((s) => {
    const plan = plans.get(s.planId);
    return plan && !underfundedIds.has(s.id) && isUpcoming(s.nextPaymentDue, plan.intervalSecs);
  });

  return (
    <div className="mx-auto max-w-4xl px-6 pt-12 pb-16">
      {error && <p className="mb-4 text-sm text-danger" style={{ animation: 'fadeUp 0.7s ease both' }}>{error}</p>}

      {underfunded.length > 0 && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet/40 bg-violet/10 px-5 py-4"
          style={{ animation: 'fadeUp 0.7s ease both' }}
        >
          <p className="text-sm text-ink">
            {underfunded.length === 1 ? (
              <>
                Your{' '}
                <span className="numeric">{formatUSDC(plans.get(underfunded[0].planId)!.amount)} USDC</span>{' '}
                charge to {shortAddress(plans.get(underfunded[0].planId)!.merchant)}{' '}
                is due, but your vault can&apos;t cover it yet — it&apos;ll go through as soon as you
                add funds.
              </>
            ) : (
              <>
                {underfunded.length} of your subscriptions are due but your vault can&apos;t cover them yet
                — they&apos;ll go through as soon as you add funds.
              </>
            )}
          </p>
          <button
            onClick={() => setVaultOpen(true)}
            className="numeric shrink-0 rounded-lg border border-violet/50 bg-violet/20 px-4 py-2 text-xs text-violet-light transition hover:bg-violet/30"
          >
            + Add funds
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mint/30 bg-mint-deep/60 px-5 py-4"
          style={{ animation: 'fadeUp 0.7s ease both' }}
        >
          <p className="text-sm text-ink">
            {upcoming.length === 1 ? (
              <>
                Your{' '}
                <span className="numeric">{formatUSDC(plans.get(upcoming[0].planId)!.amount)} USDC</span>{' '}
                charge to {shortAddress(plans.get(upcoming[0].planId)!.merchant)}{' '}
                is coming up {timeUntil(upcoming[0].nextPaymentDue)} — your vault has it covered.
              </>
            ) : (
              <>
                {upcoming.length} of your subscriptions are due soon — your vault has them covered.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── the vault ─────────────────────────────────────────── */}
      <div style={{ animation: 'fadeUp 0.7s ease both' }}>
        <VaultHero
          balance={vaultBalance}
          monthly={monthly}
          hasActive={active.length > 0}
          onOpenVault={() => setVaultOpen(true)}
        />
      </div>

      {/* ── the numbers at a glance ──────────────────────────── */}
      <div
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        style={{ animation: 'fadeUp 0.7s ease both 0.08s' }}
      >
        {[
          { label: 'Runway', value: runwayLabel(vaultBalance, monthly) ?? '—' },
          { label: 'Monthly commitment', value: charging.length ? `${formatUSDC(monthly)} USDC` : '—' },
          {
            label: 'Next charge',
            value: nextDue
              ? `${plans.get(nextDue.planId) ? formatUSDC(plans.get(nextDue.planId)!.amount) : '—'} USDC ${timeUntil(nextDue.nextPaymentDue)}`
              : '—',
          },
        ].map((stat) => (
          <GlassCard key={stat.label} className="px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">{stat.label}</p>
            <p className="numeric mt-1.5 truncate text-sm text-ink">{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* ── subscriptions — rings as sparklines ──────────────── */}
      <GlassCard hairline className="mt-6 p-6" style={{ animation: 'fadeUp 0.7s ease both 0.15s' }}>
        <div className="mb-5 flex items-center justify-between gap-2">
          <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">Subscriptions</p>
          <Link href="/dashboard/subscriptions" className="numeric text-[11px] text-ink-muted transition hover:text-ink">
            View all →
          </Link>
        </div>

        {loading && <LoadingLine label="loading subscriptions…" />}

        {!loading && tableRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-canvas/30 p-10 text-center">
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
            <ul className="space-y-2">
              {tableRows.map((sub) => {
                const plan = plans.get(sub.planId);
                const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
                const charged = justCharged.has(sub.id);
                return (
                  <li
                    key={sub.id}
                    className={`grid grid-cols-[32px_1fr_1fr_auto] items-center gap-3 rounded-xl border px-1 py-3 transition-all duration-700 sm:grid-cols-[32px_1fr_1fr_1fr_auto] ${
                      charged
                        ? 'border-mint/60 bg-mint-deep/40 shadow-[0_0_24px_-10px_var(--mint)]'
                        : 'border-line bg-canvas/30 hover:border-[#282c39]'
                    }`}
                  >
                    <CadenceRing progress={progress} size={26} strokeWidth={2} breathing={charged} />
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
                    <span className="rounded-full bg-mint-deep px-2.5 py-0.5 text-[10px] text-mint">
                      {charged ? 'Charged' : 'Active'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </GlassCard>

      <VaultModal
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        address={address}
        balance={vaultBalance}
        onChanged={refetchVaultBalance}
        stats={{
          activePlans: loading ? '…' : String(active.length),
          monthlyTotal: loading ? '…' : `${formatUSDC(monthly)} USDC`,
          nextCharge: loading ? '…' : nextDue ? timeUntil(nextDue.nextPaymentDue) : '—',
        }}
        monthlyTotalRaw={monthly}
      />
    </div>
  );
}
