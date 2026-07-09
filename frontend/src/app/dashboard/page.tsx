'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/features/subscriptions';
import { useAuth } from '@/features/auth';
import { EscrowChart, VaultModal, VaultPanel } from '@/features/vault';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { cycleProgress, formatUSDC, intervalLabel, monthlyEquivalent, shortAddress, timeUntil } from '@/lib/format';
import { getVaultBalance } from '@/lib/wallet';

function PreviewBadge() {
  return (
    <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
      PREVIEW
    </span>
  );
}

// Overview — three panels, room to breathe. The vault (the one gradient
// panel) and the escrow chart share the top row; the subscriptions table
// gets the full width below. Actions live inside the vault, where they
// belong — open it.
export default function OverviewPage() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultBalance, setVaultBalance] = useState<bigint | null>(null);
  const [balanceNonce, setBalanceNonce] = useState(0);

  const { subscriptions, loading, error } = useSubscriptions(address);

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

  const active = subscriptions.filter((s) => s.active);
  // monthly commitment across active subs — display math only
  const monthly = active.reduce((sum, s) => {
    const p = plans.get(s.planId);
    return p ? sum + monthlyEquivalent(p.amount, p.intervalSecs) : sum;
  }, 0n);
  const nextDue = active.length
    ? active.reduce((a, b) => (a.nextPaymentDue < b.nextPaymentDue ? a : b))
    : null;
  const tableRows = [...active]
    .sort((a, b) => a.nextPaymentDue.getTime() - b.nextPaymentDue.getTime())
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-4xl px-6 pt-12 pb-16">
      {error && <p className="mb-4 text-sm text-danger" style={{ animation: 'fadeUp 0.7s ease both' }}>{error}</p>}

      <div
        className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]"
        style={{ animation: 'fadeUp 0.7s ease both' }}
      >
        {/* ── the vault — the one gradient panel ─────────────── */}
        <VaultPanel onOpen={() => setVaultOpen(true)} balance={vaultBalance} />

        {/* ── escrow over time ───────────────────────────────── */}
        <GlassCard hairline className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">Escrow over time</p>
            <PreviewBadge />
          </div>
          <EscrowChart />
        </GlassCard>
      </div>

      {/* ── subscriptions — rings as sparklines ──────────────── */}
      <GlassCard hairline className="mt-6 p-6" style={{ animation: 'fadeUp 0.7s ease both 0.15s' }}>
        <div className="mb-5 flex items-center justify-between gap-2">
          <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">Subscriptions</p>
          <Link href="/dashboard/subscriptions" className="numeric text-[11px] text-ink-muted transition hover:text-ink">
            View all →
          </Link>
        </div>

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
                return (
                  <li
                    key={sub.id}
                    className="grid grid-cols-[32px_1fr_1fr_auto] items-center gap-3 rounded-xl border border-line bg-canvas/30 px-1 py-3 transition hover:border-[#282c39] sm:grid-cols-[32px_1fr_1fr_1fr_auto]"
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
      />
    </div>
  );
}
