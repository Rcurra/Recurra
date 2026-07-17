'use client';

import { useEffect, useRef, useState } from 'react';
import { SubDetailModal, SubscriptionCard, useSubscriptions } from '@/features/subscriptions';
import type { Subscription } from '@/types';
import { useAuth } from '@/features/auth';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { LoadingLine } from '@/components/LoadingLine';
import { formatUSDC, shortAddress } from '@/lib/format';

type Filter = 'active' | 'cancelled' | 'unavailable';

export default function SubscriptionsPage() {
  return <SubscriptionsView />;
}

function SubscriptionsView() {
  const { address } = useAuth();
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [filter, setFilter] = useState<Filter>('active');
  const [selected, setSelected] = useState<Subscription | null>(null);

  const { subscriptions, loading, error, refetch } = useSubscriptions(address);
  // The charge moment: nextPaymentDue advancing between polls IS a payment
  // having fired (markPaid runs right before debit) -- whatever triggers
  // executePayment (a terminal cast call today, Henry's scheduler once it
  // lands), this detection doesn't change.
  const prevDueRef = useRef<Map<number, number>>(new Map());
  const [justCharged, setJustCharged] = useState<Set<number>>(new Set());
  const [chargeToasts, setChargeToasts] = useState<{ id: number; sub: Subscription }[]>([]);

  useEffect(() => {
    api.plans
      .list()
      .then((list) => setPlans(new Map(list.map((p) => [p.id, p]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const prev = prevDueRef.current;
    const next = new Map<number, number>();
    const charged: Subscription[] = [];
    for (const s of subscriptions) {
      const dueMs = s.nextPaymentDue.getTime();
      next.set(s.id, dueMs);
      const prevMs = prev.get(s.id);
      if (prevMs !== undefined && dueMs > prevMs) charged.push(s);
    }
    prevDueRef.current = next;
    if (charged.length === 0) return;

    // Deferred a tick (react-hooks/set-state-in-effect) -- same reasoning
    // as useSubscriptions' nonce-refetch: don't call setState synchronously
    // inside the effect body.
    setTimeout(() => {
      setJustCharged((old) => {
        const merged = new Set(old);
        charged.forEach((s) => merged.add(s.id));
        return merged;
      });
      charged.forEach((s) => {
        const toastId = Date.now() + s.id;
        setChargeToasts((old) => [...old, { id: toastId, sub: s }]);
        setTimeout(() => {
          setChargeToasts((old) => old.filter((t) => t.id !== toastId));
        }, 5000);
      });
    }, 0);

    charged.forEach((s) => {
      setTimeout(() => {
        setJustCharged((old) => {
          const copy = new Set(old);
          copy.delete(s.id);
          return copy;
        });
      }, 4500);
    });
  }, [subscriptions]);

  // Two subscription states only — the contracts don't have a "finished"
  // subscription, just active (renews every cycle) and cancelled
  // (unsubscribe()'d). `unavailable` isn't a third on-chain state: it's a
  // still-active subscription whose PLAN the merchant has since
  // deactivated (Plan.active === false). Deactivation stops charging
  // on-chain — isDue() goes false and the Executor reverts
  // SubscriptionInactive — so nothing more is ever taken and escrow stays
  // withdrawable. Split out from `active` so that tab means strictly
  // "renewing normally"; shown as its own calm state, never as "at risk" —
  // the subscriber loses nothing.
  // `plan?.active ?? true`: a subscription whose plan hasn't loaded yet
  // reads as normal, not unavailable — no false flash before plans fetch.
  const active = subscriptions.filter((s) => s.active && (plans.get(s.planId)?.active ?? true));
  const unavailable = subscriptions.filter((s) => s.active && plans.get(s.planId)?.active === false);
  const cancelled = subscriptions.filter((s) => !s.active);
  const shown = filter === 'active' ? active : filter === 'unavailable' ? unavailable : cancelled;

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      {/* ── the pulse, given a body: a charge just fired ────────── */}
      {chargeToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
          {chargeToasts.map((t) => {
            const plan = plans.get(t.sub.planId);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-mint/40 bg-surface/90 px-4 py-3 shadow-[0_0_20px_-8px_var(--mint)] backdrop-blur-xl"
                style={{ animation: 'fadeUp 0.35s ease both' }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 8px var(--mint)' }} />
                <p className="numeric text-xs text-ink">
                  Charged {plan ? `${formatUSDC(plan.amount)} USDC` : 'a payment'}
                  {plan && <span className="text-ink-muted"> → {shortAddress(plan.merchant)}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* header row: state filters — Activity's fake preview retired now
          that receipts are real, per-subscription (open any card for its
          own receipt list, backed by an on-chain PaymentExecuted scan) */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <div className="flex items-center gap-2">
          {(
            [
              { key: 'active', label: `Active (${active.length})` },
              { key: 'unavailable', label: `Unavailable (${unavailable.length})` },
              { key: 'cancelled', label: `Cancelled (${cancelled.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`numeric rounded-full px-4 py-2 text-xs tracking-[0.04em] transition ${
                filter === t.key
                  ? 'border border-mint/40 bg-mint-deep text-mint'
                  : 'border border-line text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── the cadences — each subscription wears its ring ───── */}
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

          {loading && !error && <LoadingLine label="loading subscriptions…" />}

          {!loading && !error && shown.length === 0 && (
            <div
              className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center"
              style={{ animation: 'fadeUp 0.7s ease both 0.1s' }}
            >
              <p className="text-sm text-ink-muted">
                {filter === 'active'
                  ? 'Nothing recurring yet.'
                  : filter === 'unavailable'
                    ? 'Nothing here — every plan you hold is still offered.'
                    : 'Nothing cancelled — good.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ animation: 'fadeUp 0.7s ease both 0.1s' }}>
            {shown.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                sub={sub}
                plan={plans.get(sub.planId) ?? null}
                onClick={() => setSelected(sub)}
                justCharged={justCharged.has(sub.id)}
                unavailable={filter === 'unavailable'}
              />
            ))}
          </div>

      <SubDetailModal
        sub={selected}
        plan={selected ? (plans.get(selected.planId) ?? null) : null}
        onClose={() => setSelected(null)}
        onCancelled={refetch}
      />
    </div>
  );
}
