'use client';

import { useEffect, useState } from 'react';
import { T } from './tokens';

// A thin cadence line across the very top of the viewport, filling as the
// reader moves through the story. Same mint-to-violet gradient as the
// footer hairline and the CadenceRing -- one motif, reused, not a new one.
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 30,
        background: T.border,
        opacity: 0.5,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${T.mint}, ${T.violet})`,
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}
