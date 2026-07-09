'use client';

import Link from 'next/link';
import { shortAddress } from '@/lib/format';
import { useAuth } from './AuthContext';

// The header's address pill — identity display, linking to Settings
// (where logout lives). Not a logout button itself; one accidental
// mis-click shouldn't end a session.
export function AccountChip() {
  const { address } = useAuth();

  if (!address) return null;

  return (
    <Link
      href="/dashboard/settings"
      title="Account settings"
      className="numeric rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition hover:text-ink"
    >
      {shortAddress(address)}
    </Link>
  );
}
