'use client';

import { GlassCard } from '@/components/GlassCard';
import { VaultDoor } from './VaultDoor';

// The closed vault — no numbers out in the open. The door is the card;
// funds, actions, and session activity live behind it, in the modal.
export function VaultCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group block w-full text-left transition-transform duration-300 hover:scale-[1.01]"
      aria-haspopup="dialog"
    >
      <GlassCard
        hairline
        className="flex h-full items-center gap-5 p-5 transition-shadow duration-300 group-hover:shadow-[0_0_36px_-12px_var(--mint)]"
      >
        <VaultDoor size={84} className="breathe shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="numeric text-[13px] font-semibold uppercase tracking-[0.3em] text-ink">Vault</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            Your escrow — always yours,
            <br />
            withdraw anytime.
          </p>
          <p className="numeric mt-3 text-[10px] uppercase tracking-[0.2em] text-ink-faint transition-colors group-hover:text-mint">
            tap to open →
          </p>
        </div>
      </GlassCard>
    </button>
  );
}
