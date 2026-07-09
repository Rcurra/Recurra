'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth, AccountChip } from '@/features/auth';
import { RecurraMark } from '@/components/RecurraMark';
import { Starfield } from '@/components/Starfield';
import { RouteTransition } from '@/components/RouteTransition';

// Four tabs — Activity lives inside Subscriptions now, and logout lives
// in Settings, so the nav stays a short pill.
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions' },
  { href: '/dashboard/discover', label: 'Discover' },
  { href: '/dashboard/settings', label: 'Settings' },
] as const;

function LogoMark() {
  return <RecurraMark size={26} />;
}

// The route guard for the app shell — F2's five screens all land under
// here, sharing one nav bar and one Ambient mount instead of each page
// rebuilding its own header. Redirects to /login if unauthenticated;
// shows a calm loading state while session restore runs, so there's no
// flash of protected content before the check resolves.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas">
        <Starfield />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <RecurraMark size={48} spin />
          <p className="numeric text-[11px] uppercase tracking-[0.24em] text-ink-faint">
            Loading your account…
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* the same universe as landing/login — one design system everywhere.
          Fixed wrapper (like the landing's) so the stars hold still while
          content scrolls, and drifting planets can't widen the page. */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <Starfield />
      </div>

      {/* floating glass pill, same language as the landing/login nav */}
      <header className="sticky top-4 z-20 flex justify-center px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full border border-line bg-surface/75 px-5 py-2.5 backdrop-blur-xl">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <LogoMark />
            <span className="numeric text-sm font-semibold tracking-[0.12em] text-ink">RECURRA</span>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`numeric rounded-full px-3.5 py-1.5 text-xs tracking-[0.04em] transition ${
                    active ? 'bg-mint-deep text-mint' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {item.label.toUpperCase()}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0">
            <AccountChip />
          </div>
        </div>
      </header>

      <div className="relative z-10">
        <RouteTransition />
        {children}
      </div>
    </div>
  );
}
