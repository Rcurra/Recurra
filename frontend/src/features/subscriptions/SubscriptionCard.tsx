import { CadenceRing } from '@/components/CadenceRing';
import { GlassCard } from '@/components/GlassCard';
import { cycleProgress, formatUSDC, intervalLabel, shortAddress, timeUntil } from '@/lib/format';
import type { Plan, Subscription } from '@/types';

// The card both Subscriptions and Discover render a subscription as — one
// visual language for "a subscription" instead of two (Discover used to
// have its own compact chip strip; this is that fixed). The ring is the
// face, amount lives inside it. Three footer states, not two: still
// renewing normally, cancelled (history kept), or `unavailable` — still
// active on-chain, but the merchant has retired the plan, and that stops
// charging entirely (isDue() goes false; the Executor reverts
// SubscriptionInactive). Nothing more is ever taken and escrow stays
// withdrawable, so this state must never read as "something's wrong with
// YOUR subscription" — nothing was lost.
export function SubscriptionCard({
  sub,
  plan,
  onClick,
  justCharged = false,
  unavailable = false,
}: {
  sub: Subscription;
  plan: Plan | null;
  onClick: () => void;
  justCharged?: boolean;
  unavailable?: boolean;
}) {
  const progress = plan ? cycleProgress(sub.nextPaymentDue, plan.intervalSecs) : 0;

  return (
    <button onClick={onClick} aria-haspopup="dialog" className="block text-left">
      <GlassCard
        hairline={sub.active}
        className={`flex h-full flex-col items-center p-6 text-center transition-all duration-700 hover:-translate-y-1 ${
          justCharged
            ? 'border-mint/60 shadow-[0_0_28px_-8px_var(--mint)]'
            : !sub.active || unavailable
              ? 'opacity-70'
              : 'hover:shadow-[0_0_14px_-10px_var(--mint)]'
        }`}
      >
        {/* the ring is the face — amount lives inside it */}
        <div className="relative">
          {justCharged &&
            [0, 1].map((i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-mint/50"
                style={{ animation: `shellWave ${1.4 + i * 0.5}s ease-out ${i * 0.15}s` }}
              />
            ))}
          {/* a retired plan never charges again, so drawing cycle progress
              toward a charge that will never fire would be a lie — the ring
              sits empty, same as cancelled. Breathing is likewise reserved
              for subs that are actually renewing. */}
          <CadenceRing
            progress={sub.active && !unavailable ? progress : 0}
            size={104}
            strokeWidth={3.5}
            breathing={sub.active && !unavailable}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="numeric text-lg font-semibold leading-none text-ink">
              {plan ? formatUSDC(plan.amount) : `#${sub.planId}`}
            </p>
            <p className="numeric mt-1 text-[9px] uppercase tracking-[0.14em] text-ink-faint">USDC</p>
          </div>
        </div>

        <p className="numeric mt-4 text-xs text-ink-muted">
          {plan ? `every ${intervalLabel(plan.intervalSecs)}` : 'plan details unavailable'}
        </p>
        {plan && <p className="numeric mt-1 text-[11px] text-ink-faint">to {shortAddress(plan.merchant)}</p>}

        <div className="mt-4 w-full border-t border-line pt-3">
          {!sub.active ? (
            <p className="text-xs text-ink-faint">cancelled — history kept</p>
          ) : unavailable ? (
            <p className="text-xs text-ink-faint">plan retired by the merchant — no more charges; your escrow stays yours</p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">
                next charge <span className="numeric text-ink">{timeUntil(sub.nextPaymentDue)}</span>
              </p>
              {plan && (
                <p className="mt-1 text-[11px] text-ink-faint">max exposure {formatUSDC(plan.amount)} USDC</p>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </button>
  );
}
