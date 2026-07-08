'use client';

import { RecurraMark } from '@/components/RecurraMark';
import { Reveal } from './Reveal';
import { T } from './tokens';

// Footer — a closing line, a thin gradient hairline, the mark, and one real
// link (the actual repo — no fabricated socials, no dead icons).

export function Footer() {
  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '20px 24px 40px',
      }}
    >
      <Reveal style={{ textAlign: 'center', marginBottom: 40 }}>
        <p
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(18px, 2.4vw, 26px)',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: T.headline,
            margin: 0,
          }}
        >
          Set it up once. Never think about it again.
        </p>
      </Reveal>

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
          <span className="numeric" style={{ fontSize: 11, letterSpacing: '0.06em', color: T.faint }}>
            · BUILT AT A HACKATHON
          </span>
        </div>
        <a
          href="https://github.com/Rcurra/Recurra"
          target="_blank"
          rel="noreferrer"
          className="numeric"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 999,
            border: `1px solid ${T.border}`,
            fontSize: 11,
            letterSpacing: '0.1em',
            color: T.dim,
            textDecoration: 'none',
          }}
        >
          GITHUB <span style={{ color: T.mint }}>↗</span>
        </a>
      </div>
    </footer>
  );
}
