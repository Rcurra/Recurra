'use client';

import { useRouter } from 'next/navigation';
import { RecurraMark } from '@/components/RecurraMark';

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
  return <RecurraMark size={28} />;
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
        @keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(7px,-11px); } }
        @keyframes planetGlow { 0%,100% { opacity: 0.26; } 50% { opacity: 0.46; } }
        @keyframes planetWave { 0% { transform: scale(1); opacity: 0.38; } 65% { transform: scale(2.6); opacity: 0; } 100% { transform: scale(2.6); opacity: 0; } }
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

        {/* little planets — lit spheres, not discs: upper-left highlight,
            crescent shadow lower-right, the odd surface band or ring */}
        {(
          [
            { left: '9%', top: '18%', size: 10, color: T.violetLight, ring: true, band: false, dur: 22 },
            { left: '86%', top: '13%', size: 7, color: T.mint, ring: false, band: true, dur: 26 },
            { left: '78%', top: '72%', size: 12, color: T.violet, ring: true, band: false, dur: 30 },
            { left: '14%', top: '76%', size: 6, color: T.text, ring: false, band: false, dur: 24 },
            { left: '68%', top: '32%', size: 5, color: T.mint, ring: false, band: false, dur: 28 },
            { left: '28%', top: '38%', size: 8, color: T.violetLight, ring: false, band: true, dur: 34 },
          ] as const
        ).map((p, i) => (
          <svg
            key={i}
            width={p.size * 4}
            height={p.size * 4}
            viewBox="0 0 40 40"
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              overflow: 'visible',
              animation: `drift ${p.dur}s ease-in-out infinite ${i * 1.7}s, planetGlow ${6 + (i % 3) * 2}s ease-in-out infinite ${i * 0.9}s`,
            }}
          >
            <defs>
              <radialGradient id={`p-light-${i}`} cx="34%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`p-clip-${i}`}>
                <circle cx="20" cy="20" r="7" />
              </clipPath>
            </defs>

            {/* atmosphere shell — a visible outer sphere; THIS is what pulses,
                the planet body itself never moves */}
            <circle cx="20" cy="20" r="9.5" fill="none" stroke={p.color} strokeWidth="0.5" opacity="0.22" />
            <circle
              cx="20"
              cy="20"
              r="9.5"
              fill="none"
              stroke={p.color}
              strokeWidth="0.5"
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: `planetWave ${9 + (i % 3) * 4}s ease-out infinite ${i * 1.9}s`,
              }}
            />
            {/* body */}
            <circle cx="20" cy="20" r="7" fill={p.color} opacity="0.75" />
            {/* sunlit side */}
            <circle cx="20" cy="20" r="7" fill={`url(#p-light-${i})`} />
            {/* surface band (latitude stripe) */}
            {p.band && (
              <path
                d="M13.2 18.4 Q20 21.8 26.8 18.1"
                fill="none"
                stroke="#06070B"
                strokeWidth="1.1"
                opacity="0.35"
                clipPath={`url(#p-clip-${i})`}
              />
            )}
            {/* night side — offset dark sphere clipped to the body = crescent */}
            <circle cx="23.4" cy="23.2" r="7.4" fill="#06070B" opacity="0.6" clipPath={`url(#p-clip-${i})`} />
            {/* limb */}
            <circle cx="20" cy="20" r="7" fill="none" stroke={p.color} strokeWidth="0.6" opacity="0.7" />

            {p.ring && (
              <g transform="rotate(-18 20 20)">
                <ellipse cx="20" cy="20" rx="12.5" ry="4.2" fill="none" stroke={p.color} strokeWidth="0.75" opacity="0.55" />
                <ellipse cx="20" cy="20" rx="10.5" ry="3.4" fill="none" stroke={p.color} strokeWidth="0.4" opacity="0.3" />
              </g>
            )}
          </svg>
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
            fontSize: 'clamp(38px, 6vw, 76px)',
            fontWeight: 400,
            lineHeight: 1.0,
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
            margin: 0,
            maxWidth: 880,
            color: '#C9CEDA',
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

    </div>
  );
}
