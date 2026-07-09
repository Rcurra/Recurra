'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const DURATION_MS = 180;

// A brief "page turning" flourish on route change — not gating on real
// data (each page keeps its own independent loading state for that).
// Fixed short duration, deliberately: the reference brief was Paymesh's
// loading screen, but fast, not the longer indeterminate spin they show.
export function RouteTransition() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm transition-opacity"
      style={{ background: 'rgba(6,7,11,0.4)' }}
      aria-hidden
    >
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: 'routeSpin 0.5s linear infinite' }}>
        <style>{`@keyframes routeSpin { to { transform: rotate(360deg); } }`}</style>
        <defs>
          <linearGradient id="route-transition-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--mint)" />
            <stop offset="100%" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke="url(#route-transition-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="42 26"
        />
      </svg>
    </div>
  );
}
