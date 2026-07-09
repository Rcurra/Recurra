'use client';

import { VaultDoor } from './VaultDoor';

const DOOR_SIZE = 170;

// The vault as the dashboard's sun — the main picture, not a grid cell.
// A big door with the landing planets' expanding atmosphere shells,
// typography-led beneath, the whole thing one tap target for the modal.
export function VaultHero({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-haspopup="dialog"
      className="group mx-auto flex flex-col items-center pt-2 pb-4"
    >
      <div className="relative" style={{ width: DOOR_SIZE, height: DOOR_SIZE }}>
        {/* soft glow behind the door — brightens on hover */}
        <div
          className="absolute inset-0 rounded-full opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-90"
          style={{ background: 'radial-gradient(circle, rgba(0,229,160,0.25), transparent 70%)' }}
        />
        {/* atmosphere shells — the pulse, expanding off the door */}
        {[0, 1].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-mint/40"
            style={{ animation: `shellWave ${7 + i * 3}s ease-out infinite ${i * 2.2}s` }}
          />
        ))}
        <VaultDoor size={DOOR_SIZE} className="breathe relative" />
      </div>

      <p className="numeric mt-6 text-base font-semibold uppercase tracking-[0.4em] text-ink">Vault</p>
      <p className="mt-1.5 text-xs text-ink-muted">your escrow — always yours</p>
      <p className="numeric mt-3 text-[10px] uppercase tracking-[0.24em] text-ink-faint transition-colors duration-300 group-hover:text-mint">
        tap to open →
      </p>
    </button>
  );
}
