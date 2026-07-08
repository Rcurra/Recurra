'use client';

import { useRouter } from 'next/navigation';
import { shortAddress } from '@/lib/format';
import { useAuth } from './AuthContext';

// The dashboard header's address pill — doubles as the logout control.
export function AccountChip() {
  const { address, logout } = useAuth();
  const router = useRouter();

  if (!address) return null;

  return (
    <button
      onClick={async () => {
        await logout();
        router.push('/');
      }}
      title="Log out"
      className="numeric rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition hover:border-danger/40 hover:text-danger"
    >
      {shortAddress(address)}
    </button>
  );
}
