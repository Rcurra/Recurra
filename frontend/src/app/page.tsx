'use client';

import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────
// Recurra — landing. Typography is the hero, the starfield is the
// only atmosphere. Subtle over loud. Dark only, like the product.
// ─────────────────────────────────────────────────────────────

const T = {
  bg: '#06070B',
  cardGlass: 'rgba(14,16,23,0.72)',
  border: '#1A1D27',
  borderBright: '#282C39',
  text: '#F2F3F7',
  dim: '#8E94A3',
  faint: '#565C6B',
  mint: '#00E5A0',
  violet: '#6C5CE7',
  violetLight: '#8B7DF0',
} as const;

function LogoMark() {
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: `1.5px solid ${T.mint}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: `1.5px solid ${T.violet}`,
          borderTopColor: 'transparent',
          transform: 'rotate(45deg)',
        }}
      />
    </span>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const launch = () => router.push('/login');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes starTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.6; } }
      `}</style>

      {/* starfield — the only atmosphere */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {Array.from({ length: 64 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: i % 5 === 0 ? 2.5 : 1.5,
              height: i % 5 === 0 ? 2.5 : 1.5,
              borderRadius: '50%',
              background: i % 4 === 0 ? T.mint : i % 4 === 1 ? T.violetLight : T.text,
              opacity: 0.22,
              animation: `starTwinkle ${3 + (i % 4)}s ease-in-out infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* nav: just the name and the mark. nothing else. */}
      <nav
        style={{
          position: 'fixed',
          top: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <LogoMark />
        <span className="numeric" style={{ fontWeight: 600, fontSize: 14, letterSpacing: '0.16em', color: T.text }}>
          RECURRA
        </span>
      </nav>

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px 48px',
          textAlign: 'center',
        }}
      >
        <div
          className="numeric"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            marginBottom: 34,
            border: `1px solid ${T.border}`,
            background: T.cardGlass,
            fontSize: 11,
            color: T.dim,
            letterSpacing: '0.12em',
            animation: 'fadeUp 0.8s ease both',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.mint }} />
          POWERED BY EIP-7702 · PARTICLE UNIVERSAL ACCOUNTS
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(44px, 7.5vw, 96px)',
            fontWeight: 400,
            lineHeight: 1.0,
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
            margin: 0,
            maxWidth: 880,
            color: T.text,
            animation: 'fadeUp 1s ease both 0.15s',
          }}
        >
          Payments that
          <br />
          run themselves
        </h1>

        <p
          className="numeric"
          style={{
            fontSize: 12.5,
            color: T.dim,
            letterSpacing: '0.22em',
            margin: '24px 0 0',
            textTransform: 'uppercase',
            animation: 'fadeUp 1s ease both 0.3s',
          }}
        >
          Fund once · Approve once · Pay forever — on any chain
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 34, animation: 'fadeUp 1s ease both 0.45s' }}>
          <button
            onClick={launch}
            style={{
              padding: '13px 28px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              background: T.violet,
              color: T.text,
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            LAUNCH APP
          </button>
          <button
            style={{
              padding: '13px 28px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              background: 'transparent',
              color: T.text,
              border: `1px solid ${T.borderBright}`,
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            DEMO <span style={{ color: T.mint, fontSize: 12 }}>▶</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 26,
            marginTop: 48,
            flexWrap: 'wrap',
            justifyContent: 'center',
            animation: 'fadeUp 1s ease both 0.6s',
          }}
        >
          {['Magic', 'ZeroDev', 'Openfort', 'Particle', 'Arbitrum'].map((n) => (
            <span key={n} className="numeric" style={{ fontSize: 12, color: T.faint, letterSpacing: '0.08em' }}>
              {n}
            </span>
          ))}
        </div>
      </div>

      <div
        className="numeric"
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          color: T.faint,
          letterSpacing: '0.2em',
          zIndex: 10,
        }}
      >
        SCROLL TO EXPLORE
      </div>
    </div>
  );
}
