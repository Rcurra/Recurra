'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { GlassCard } from '@/components/GlassCard';
import { shortAddress } from '@/lib/format';
import { MOCK_PERMISSIONS } from '@/lib/mockData';

export default function SettingsPage() {
  const { address, email, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      {/* ── account ─────────────────────────────────────────── */}
      <p className="numeric mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-faint" style={{ animation: 'fadeUp 0.7s ease both' }}>
        Account
      </p>
      <GlassCard hairline className="mb-10 flex flex-wrap items-center justify-between gap-4 p-6" style={{ animation: 'fadeUp 0.7s ease both 0.08s' }}>
        <div>
          <p className="text-sm text-ink">{email ?? 'signed in — no seed phrase, ever'}</p>
          <p className="numeric mt-1 text-xs text-ink-muted">{address ? shortAddress(address) : '—'}</p>
        </div>
        <button
          onClick={async () => {
            await logout();
            router.push('/');
          }}
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition hover:border-danger/50 hover:text-danger"
        >
          Log out
        </button>
      </GlassCard>

      {/* ── permissions ─────────────────────────────────────── */}
      <div className="mb-1 flex items-center gap-2" style={{ animation: 'fadeUp 0.7s ease both 0.16s' }}>
        <p className="numeric text-[11px] uppercase tracking-[0.24em] text-ink-faint">Permissions</p>
        <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
          PREVIEW
        </span>
      </div>
      <p className="mb-6 text-xs text-ink-faint" style={{ animation: 'fadeUp 0.7s ease both 0.16s' }}>
        Sample permissions — real session-key scope arrives with F4. Read-only, always.
      </p>

      <ul className="space-y-3" style={{ animation: 'fadeUp 0.7s ease both 0.24s' }}>
        {MOCK_PERMISSIONS.map((p) => (
          <li key={p.sentence} className="rounded-2xl border border-line bg-surface/75 p-5 backdrop-blur-xl">
            <p className="text-sm text-ink">{p.sentence}</p>
            {p.expiresIn && <p className="numeric mt-1.5 text-xs text-ink-faint">{p.expiresIn}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
