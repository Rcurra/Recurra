'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { RecurraMark } from '@/components/RecurraMark';
import { Starfield } from '@/components/Starfield';

// The route guard for the app shell — F2's five screens all land under
// here. Redirects to /login if unauthenticated; shows a calm loading
// state while session restore runs, so there's no flash of protected
// content before the check resolves.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

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

  return <>{children}</>;
}
