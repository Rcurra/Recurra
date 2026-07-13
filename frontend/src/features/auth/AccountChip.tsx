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
      <button
        onClick={() => setOpen(true)}
        title="Your wallet"
        className="numeric flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition hover:border-ink/40 hover:text-ink"
      >
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">Wallet</span>
        {shortAddress(address)}
      </button>
      <WalletModal open={open} address={address} onClose={() => setOpen(false)} />
    </>
  );
}
