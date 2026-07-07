'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────
// Recurra — landing. Typography IS the hero; the orb haunts the
// background. Floating pill nav, giant condensed caps, pill CTAs.
// Dark only, like the product.
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
  coreFill: '#0A0C12',
  ctaText: '#04140F',
} as const;

const CHAINS = [
  { id: 'solana', color: '#14F195', angle: 90 },
  { id: 'arbitrum', color: '#28A0F0', angle: 210 },
  { id: 'base', color: '#3C7DFF', angle: 330 },
  { id: 'polygon', color: '#A66DF5', angle: 30 },
  { id: 'avalanche', color: '#E84142', angle: 150 },
  { id: 'optimism', color: '#FF5C5C', angle: 270 },
] as const;

// The orb, as atmosphere: no center label, meant to sit faint behind type.
function BackdropOrb({ size = 640 }: { size?: number }) {
  const cx = size / 2,
    cy = size / 2,
    coreR = size * 0.14,
    orbitR = size * 0.37;
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 900);
    }, 3400);
    return () => clearInterval(iv);
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }} aria-hidden>
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={T.mint} stopOpacity="0.9" />
          <stop offset="45%" stopColor={T.violet} stopOpacity="0.55" />
          <stop offset="100%" stopColor={T.violet} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ambientHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={T.violet} stopOpacity="0.18" />
          <stop offset="60%" stopColor={T.violet} stopOpacity="0.04" />
          <stop offset="100%" stopColor={T.violet} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={T.mint} stopOpacity="0.65" />
          <stop offset="100%" stopColor={T.violet} stopOpacity="0.65" />
        </linearGradient>
      </defs>

      <circle cx={cx} cy={cy} r={size / 2} fill="url(#ambientHalo)" />

      <circle
        cx={cx}
        cy={cy}
        r={orbitR}
        fill="none"
        stroke="url(#orbitGrad)"
        strokeWidth="1"
        strokeDasharray="2 7"
        opacity={0.55}
        style={{ transformOrigin: 'center', animation: 'spin 60s linear infinite' }}
      />
      <circle cx={cx} cy={cy} r={orbitR * 0.8} fill="none" stroke={T.border} strokeWidth="1" opacity={0.8} />
      <circle
        cx={cx}
        cy={cy}
        r={orbitR * 1.18}
        fill="none"
        stroke={T.border}
        strokeWidth="1"
        strokeDasharray="1 9"
        opacity={0.55}
        style={{ transformOrigin: 'center', animation: 'spinRev 90s linear infinite' }}
      />

      {CHAINS.map((ch, i) => {
        const rad = (ch.angle * Math.PI) / 180;
        const x = cx + Math.cos(rad) * orbitR,
          y = cy + Math.sin(rad) * orbitR;
        return (
          <line
            key={ch.id}
            x1={x}
            y1={y}
            x2={cx}
            y2={cy}
            stroke={ch.color}
            strokeWidth="1"
            opacity={pulse ? 0.45 : 0.1}
            strokeDasharray="2 4"
            style={{ transition: 'opacity 0.5s', animation: `flow 1.4s linear infinite ${i * 0.2}s` }}
          />
        );
      })}

      {pulse && (
        <circle
          cx={cx}
          cy={cy}
          r={coreR}
          fill="none"
          stroke={T.mint}
          strokeWidth="1.5"
          style={{ animation: 'wave 0.9s ease-out forwards' }}
        />
      )}

      <circle
        cx={cx}
        cy={cy}
        r={coreR * 1.4}
        fill="url(#coreGlow)"
        style={{ animation: 'breathe 4.5s ease-in-out infinite' }}
      />
      <circle cx={cx} cy={cy} r={coreR} fill={T.coreFill} stroke="url(#orbitGrad)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={coreR} fill="url(#coreGlow)" opacity={0.3} />

      {CHAINS.map((ch) => {
        const rad = (ch.angle * Math.PI) / 180;
        const x = cx + Math.cos(rad) * orbitR,
          y = cy + Math.sin(rad) * orbitR;
        return (
          <g key={ch.id} style={{ animation: 'bob 6s ease-in-out infinite' }}>
            <circle cx={x} cy={y} r={size * 0.032} fill={T.coreFill} stroke={ch.color} strokeWidth="1.5" />
            <circle
              cx={x}
              cy={y}
              r={size * 0.01}
              fill={ch.color}
              style={{ filter: `drop-shadow(0 0 6px ${ch.color})` }}
            />
          </g>
        );
      })}
    </svg>
  );
}

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

// Floating pill nav — detached from the top edge, everything in one capsule.
function PillNav({ onLaunch }: { onLaunch: () => void }) {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        padding: '8px 8px 8px 18px',
        borderRadius: 999,
        background: T.cardGlass,
        border: `1px solid ${T.border}`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 8px 32px -12px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoMark />
        <span className="numeric" style={{ fontWeight: 600, fontSize: 14, letterSpacing: '0.14em', color: T.text }}>
          RECURRA
        </span>
      </div>
      <button
        onClick={onLaunch}
        style={{
          padding: '9px 20px',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.04em',
          background: T.violet,
          color: T.text,
          border: 'none',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: `0 4px 18px -6px ${T.violet}`,
        }}
      >
        LAUNCH APP
      </button>
    </nav>
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spinRev { to { transform: rotate(-360deg); } }
        @keyframes wave { from { opacity: 0.7; transform: scale(1); } to { opacity: 0; transform: scale(2.6); } }
        @keyframes flow { to { stroke-dashoffset: -12; } }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes starTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.6; } }
      `}</style>

      {/* starfield */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {Array.from({ length: 56 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: i % 5 === 0 ? 2.5 : 1.5,
              height: i % 5 === 0 ? 2.5 : 1.5,
              borderRadius: '50%',
              background: i % 3 === 0 ? T.mint : i % 3 === 1 ? T.violetLight : T.text,
              opacity: 0.25,
              animation: `starTwinkle ${3 + (i % 4)}s ease-in-out infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* the orb, faint, behind everything */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -54%)',
          opacity: 0.4,
          pointerEvents: 'none',
        }}
      >
        <BackdropOrb size={680} />
      </div>

      {/* vignette so the type owns the center */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 55% at 50% 46%, rgba(6,7,11,0.55), transparent 55%), radial-gradient(ellipse 80% 60% at 50% 40%, transparent, ${T.bg} 82%)`,
          pointerEvents: 'none',
        }}
      />

      <PillNav onLaunch={launch} />

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
            marginBottom: 28,
            border: `1px solid ${T.border}`,
            background: T.cardGlass,
            fontSize: 11,
            color: T.dim,
            letterSpacing: '0.12em',
            animation: 'fadeUp 0.8s ease both',
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: T.mint, boxShadow: `0 0 8px ${T.mint}` }}
          />
          POWERED BY EIP-7702 · PARTICLE UNIVERSAL ACCOUNTS
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(56px, 11vw, 148px)',
            fontWeight: 400,
            lineHeight: 0.96,
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
            margin: 0,
            maxWidth: 1000,
            animation: 'fadeUp 1s ease both 0.15s',
            textShadow: '0 8px 60px rgba(0,0,0,0.55)',
          }}
        >
          Payments that
          <br />
          <span style={{ color: T.mint }}>run themselves</span>
        </h1>

        <p
          className="numeric"
          style={{
            fontSize: 13,
            color: T.dim,
            letterSpacing: '0.22em',
            margin: '26px 0 0',
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
              padding: '14px 30px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              background: T.violet,
              color: T.text,
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 8px 30px -8px ${T.violet}`,
            }}
          >
            LAUNCH APP
          </button>
          <button
            style={{
              padding: '14px 30px',
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
            marginTop: 44,
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
