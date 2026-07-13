'use client';

import { RecurraMark } from '@/components/RecurraMark';
import { Reveal } from './Reveal';
import { T } from './tokens';

// Footer — a closing line, a thin white hairline, the mark, and one real
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
            fontSize: 'clamp(15px, 1.8vw, 21px)',
            fontWeight: 400,
            letterSpacing: '0.05em',
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
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
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
          <span style={{ fontSize: 13, letterSpacing: '0.14em', color: T.dim }}>
            RECURRA
          </span>
          <span style={{ fontSize: 11, letterSpacing: '0.06em', color: T.faint }}>
            · BUILT AT A HACKATHON
          </span>
        </div>
        <a
          href="https://github.com/Rcurra/Recurra"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 999,
            border: `1px solid ${T.border}`,
            background: T.cardGlass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            fontSize: 11,
            letterSpacing: '0.1em',
            color: T.dim,
            textDecoration: 'none',
          }}
        >
          GITHUB <span style={{ color: T.text }}>↗</span>
        </a>
      </div>
    </footer>
  );
}
