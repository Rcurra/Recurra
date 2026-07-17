'use client';

import Link from 'next/link';
import { GlassPanel } from '@/components/GlassPanel';
import { formatUSDC, runwayLabel } from '@/lib/format';

// The vault hero, in the landing's grammar: balance as the headline, the
// promise underneath, two permanent actions. Used to carry an orbit
// visualization here (each subscription its own ring around the vault) —
// removed 2026-07-17: it stopped reading as a system and started reading
// as clutter once a handful of subscriptions were active at once, capped
// at showing only 3 anyway. The Subscriptions list right below this card
// already shows every active subscription, in order, with its own ring —
// that's the real "see them all" surface now, not a scaled-down replica
// of it crammed into the hero.
export function VaultHero({
  balance,
  monthly,
  hasActive,
  onOpenVault,
}: {
  balance: bigint | null;
  monthly: bigint; // total across ALL active subscriptions, not just a shown subset
  hasActive: boolean;
  onOpenVault: () => void;
}) {
  const runway = runwayLabel(balance, monthly);

  return (
    <GlassPanel hairline className="relative">
      <div className="flex flex-col items-start px-8 py-7">
        <p className="text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          Vault — your escrow, always yours
        </p>

        <p className="numeric mt-6 text-5xl font-light text-ink">
          {balance === null ? '—' : formatUSDC(balance)}
          <span className="pl-2 text-lg text-ink-muted">USDC</span>
        </p>

        {runway ? (
          <p className="mt-3 text-xs tracking-[0.06em] text-ink-muted">covers everything for {runway}</p>
        ) : (
          <p className="mt-3 text-xs tracking-[0.06em] text-ink/90">
            {hasActive ? ' ' : 'fund it once — everything recurring pays itself from here'}
          </p>
        )}
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          withdraw anytime — it never stops being yours
        </p>

        <div className="mt-7 flex gap-2.5">
          <button
            onClick={onOpenVault}
            className="rounded-full bg-ink px-6 py-2.5 text-[11.5px] font-semibold tracking-[0.08em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
          >
            Add funds
          </button>
          <button
            onClick={onOpenVault}
            className="rounded-full border border-ink/30 bg-canvas/40 px-6 py-2.5 text-[11.5px] tracking-[0.08em] text-ink backdrop-blur-xl transition hover:border-ink/60"
          >
            Withdraw
          </button>
        </div>

        {!hasActive && (
          <p className="mt-5 text-[11px] text-ink-faint">
            <Link
              href="/dashboard/discover"
              className="text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
            >
              Browse plans
            </Link>{' '}
            to set up your first subscription.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}
