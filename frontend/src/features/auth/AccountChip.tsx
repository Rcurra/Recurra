'use client';

import { useState } from 'react';
import { WalletModal } from '@/features/wallet';
import { shortAddress } from '@/lib/format';
import { useAuth } from './AuthContext';

// The header's wallet pill — "Wallet" plus the truncated address. Opens
// the WalletModal: balance, the full receive address, and Send. (It used
// to link to Settings; Settings has its own nav tab, but the wallet had
// no door at all — "your money never leaves your control" needs one.)
export function AccountChip() {
  const { address } = useAuth();
  const [open, setOpen] = useState(false);

  if (!address) return null;

  return (
    <>
      {/* structured in three beats — a breathing dot (the wallet is
          live), a bold tracked label, the address in full weight — and
          the invitation grammar on hover: the whole chip fills white */}
      <button
        onClick={() => setOpen(true)}
        title="Your wallet"
        className="group flex items-center gap-2.5 rounded-full border border-ink/25 bg-surface px-4 py-2 transition hover:border-ink hover:bg-ink hover:shadow-[0_4px_20px_-4px_rgba(255,255,255,0.35)]"
      >
        <span className="breathe h-1.5 w-1.5 rounded-full bg-ink transition group-hover:bg-canvas" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink transition group-hover:text-canvas">
          Wallet
        </span>
        <span className="numeric text-xs font-semibold text-ink-muted transition group-hover:text-canvas">
          {shortAddress(address)}
        </span>
      </button>
      <WalletModal open={open} address={address} onClose={() => setOpen(false)} />
    </>
  );
}
