'use client';

import { RecurraMark } from '@/components/RecurraMark';
import { T } from './tokens';

// Footer — a thin gradient hairline, the mark, and a couple of quiet links.
// No socials to fake; a hackathon credit line instead of dead icons.

export function Footer() {
  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '0 24px 40px',
      }}
    >
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${T.mint}, ${T.violet}, transparent)`,
          opacity: 0.35,
          marginBottom: 28,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RecurraMark size={22} />
          <span className="numeric" style={{ fontSize: 13, letterSpacing: '0.14em', color: T.dim }}>
            RECURRA
          </span>
        </div>
        <span className="numeric" style={{ fontSize: 11, letterSpacing: '0.08em', color: T.faint }}>
          BUILT AT A HACKATHON · PAYMENTS THAT RUN THEMSELVES
        </span>
      </div>
    </footer>
  );
}
