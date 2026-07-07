'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/features/subscriptions';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { CadenceRing } from '@/components/CadenceRing';
import { Ambient } from '@/components/Ambient';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress, timeUntil } from '@/lib/format';

function LogoMark() {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center rounded-[7px] border-[1.5px] border-mint">
      <span className="h-[9px] w-[9px] rotate-45 rounded-full border-[1.5px] border-violet border-t-transparent" />
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());

  useEffect(() => {
    const addr = localStorage.getItem('recurra_address');
    if (!addr) {
      router.push('/login');
      return;
    }
    setAddress(addr);
  }, [router]);

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

  return (
    <main className="relative min-h-screen bg-canvas">
      <Ambient />

      <header className="sticky top-0 z-20 border-b border-line bg-surface/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="numeric text-sm font-semibold tracking-[0.12em] text-ink">RECURRA</span>
          </div>
          {address && (
            <span className="numeric rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted">
              {shortAddress(address)}
            </span>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        {/* ── the vault — hero object ─────────────────────────── */}
        <p className="numeric mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-faint">Your vault</p>
        <section className="relative mb-10 overflow-hidden rounded-2xl border border-line bg-surface p-6">
          {/* gradient hairline along the top edge */}
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
              {
                label: 'Active plans',
                value: loading ? '…' : String(active.length),
              },
              {
                label: 'Monthly total',
                value: loading ? '…' : `${formatUSDC(monthly)} USDC`,
              },
              {
                label: 'Next charge',
                value: loading ? '…' : nextDue ? timeUntil(nextDue.nextPaymentDue) : '—',
              },
            ].map((s) => (
              <div key={s.label} className="bg-surface-2 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">{s.label}</p>
                <p className="numeric mt-1 text-sm text-ink">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── subscriptions ───────────────────────────────────── */}
        <p className="numeric mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-faint">
          Your subscriptions
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && subscriptions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-10 text-center">
            <p className="text-sm text-ink-muted">Nothing recurring yet.</p>
            <p className="mt-1 text-xs text-ink-faint">Browse plans to set up your first one.</p>
          </div>
        )}

        <ul className="space-y-3">
          {subscriptions.map((sub) => {
            const plan = plans.get(sub.planId);
            const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;
            return (
              <li
                key={sub.id}
                className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:border-[#282c39] hover:bg-surface-2"
              >
                <div className="relative">
                  <CadenceRing progress={sub.active ? progress : 0} size={52} />
                  {sub.active && (
                    <span
                      className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-mint"
                      style={{ boxShadow: '0 0 8px var(--mint)' }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">
                    {plan ? (
                      <>
                        <span className="numeric">{formatUSDC(plan.amount)} USDC</span>
                        <span className="text-ink-muted"> / {intervalLabel(plan.intervalSecs)}</span>
                      </>
                    ) : (
                      `Plan #${sub.planId}`
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {sub.active ? (
                      <>
                        next charge <span className="numeric text-ink-muted">{timeUntil(sub.nextPaymentDue)}</span>
                        {plan && (
                          <span className="text-ink-faint">
                            {' '}
                            · max exposure {formatUSDC(plan.amount)} USDC
                          </span>
                        )}
                      </>
                    ) : (
                      'cancelled — history kept'
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    sub.active ? 'bg-mint-deep text-mint' : 'border border-line text-ink-faint'
                  }`}
                >
                  {sub.active ? 'Active' : 'Ended'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
