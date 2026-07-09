'use client';

import { VaultDoor } from './VaultDoor';

// The one elevated panel on the dashboard — every other panel is dark
// glass; the vault wears the gradient. Balance + the door, one tap target
// for the modal.
export function VaultPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-haspopup="dialog"
      className="group relative block h-full w-full overflow-hidden rounded-2xl border border-line p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-14px_var(--mint)]"
      style={{
        background:
          'linear-gradient(135deg, rgba(0,229,160,0.14) 0%, rgba(14,16,23,0.85) 45%, rgba(108,92,231,0.22) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* hairline */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--mint), var(--violet), transparent)' }}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="numeric text-[11px] font-semibold uppercase tracking-[0.3em] text-ink">Vault</p>
        <VaultDoor size={56} className="breathe shrink-0" />
      </div>

      <p className="numeric mt-3 text-3xl font-semibold text-ink">
        —<span className="text-base text-ink-faint">.—— USDC</span>
      </p>
      <p className="mt-1 text-[11px] text-ink-muted">escrow — always yours, withdraw anytime</p>

      <p className="numeric mt-4 text-[10px] uppercase tracking-[0.22em] text-ink-faint transition-colors duration-300 group-hover:text-mint">
        tap to open →
      </p>
    </button>
  );
}
