'use client';

import { useEffect } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { formatUSDC, shortAddress, timeAgo } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';
import { VaultDoor } from './VaultDoor';

// The open vault. Funds, actions, the stat strip, and what moved through
// Recurra this session — everything the card deliberately keeps behind
// the door. Stats come in as props; the page already computes them.
export function VaultModal({
  open,
  onClose,
  stats,
}: {
  open: boolean;
  onClose: () => void;
  stats: { activePlans: string; monthlyTotal: string; nextCharge: string };
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vault"
    >
      {/* backdrop — click to close */}
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassCard hairline className="max-h-[85vh] overflow-y-auto p-6">
          {/* header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VaultDoor size={36} />
              <p className="numeric text-[13px] font-semibold uppercase tracking-[0.3em] text-ink">Vault</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close vault"
              className="rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-danger/40 hover:text-danger"
            >
              ×
            </button>
          </div>

          {/* balance */}
          <p className="numeric text-3xl font-semibold text-ink">
            —<span className="text-lg text-ink-faint">.—— USDC</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">escrow balance — arrives with the balance API</p>

          {/* actions */}
          <div className="mt-5 flex gap-2.5">
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

          {/* stat strip */}
          <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
            {[
              { label: 'Active plans', value: stats.activePlans },
              { label: 'Monthly total', value: stats.monthlyTotal },
              { label: 'Next charge', value: stats.nextCharge },
            ].map((s) => (
              <div key={s.label} className="bg-surface-2 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">{s.label}</p>
                <p className="numeric mt-1 text-sm text-ink">{s.value}</p>
              </div>
            ))}
          </div>

          {/* session activity */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <p className="numeric text-[10px] uppercase tracking-[0.24em] text-ink-faint">Session activity</p>
              <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
                PREVIEW
              </span>
            </div>
            <ul className="space-y-2">
              {MOCK_RECEIPTS.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/40 px-4 py-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 6px var(--mint)' }} />
                  <p className="numeric min-w-0 flex-1 truncate text-xs text-ink">
                    {formatUSDC(r.amount)} USDC
                    <span className="text-ink-faint"> → {shortAddress(r.merchant)}</span>
                  </p>
                  <span className="numeric shrink-0 text-[11px] text-ink-muted">{timeAgo(r.paidAt)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-faint">
              Sample rows — live session events arrive with F3 writes and F5 history.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
