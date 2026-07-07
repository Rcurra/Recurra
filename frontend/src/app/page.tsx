'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────
// Recurra — landing (theater; the app inside stays calm)
// Dark only, like the product.
// ─────────────────────────────────────────────────────────────

const T = {
  bg: '#06070B',
  card: '#0E1017',
  cardGlass: 'rgba(14,16,23,0.7)',
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
  launchBg: '#F2F3F7',
  launchText: '#06070B',
} as const;

const CHAINS = [
  { id: 'solana', color: '#14F195', angle: 90 },
  { id: 'arbitrum', color: '#28A0F0', angle: 210 },
  { id: 'base', color: '#3C7DFF', angle: 330 },
  { id: 'polygon', color: '#A66DF5', angle: 30 },
  { id: 'avalanche', color: '#E84142', angle: 150 },
  { id: 'optimism', color: '#FF5C5C', angle: 270 },
] as const;

function HeroOrb() {
  const size = 360;
  const cx = size / 2,
    cy = size / 2,
    coreR = 52,
    orbitR = 134;
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 900);
    }, 3400);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ position: 'relative', width: size, height: size, maxWidth: '90vw' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', maxWidth: '100%', height: 'auto' }}
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={T.mint} stopOpacity="0.9" />
            <stop offset="45%" stopColor={T.violet} stopOpacity="0.55" />
            <stop offset="100%" stopColor={T.violet} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ambientHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={T.violet} stopOpacity="0.16" />
            <stop offset="60%" stopColor={T.violet} stopOpacity="0.03" />
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
          opacity={0.6}
          style={{ transformOrigin: 'center', animation: 'spin 60s linear infinite' }}
        />
        <circle cx={cx} cy={cy} r={orbitR - 28} fill="none" stroke={T.border} strokeWidth="1" opacity={0.85} />
        <circle
          cx={cx}
          cy={cy}
          r={orbitR + 24}
          fill="none"
          stroke={T.border}
          strokeWidth="1"
          strokeDasharray="1 9"
          opacity={0.6}
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
              opacity={pulse ? 0.5 : 0.12}
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
          r={coreR + 22}
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
              <circle cx={x} cy={y} r="15" fill={T.coreFill} stroke={ch.color} strokeWidth="1.5" />
              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill={ch.color}
                style={{ filter: `drop-shadow(0 0 6px ${ch.color})` }}
              />
            </g>
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div className="numeric" style={{ fontSize: 10, letterSpacing: '0.24em', color: T.dim, marginBottom: 4 }}>
          ONE BALANCE
        </div>
        <div
          className="numeric"
          style={{ fontSize: 30, fontWeight: 600, color: T.text, letterSpacing: '-0.02em', lineHeight: 1 }}
        >
          ∞
        </div>
        <div className="numeric" style={{ fontSize: 10, letterSpacing: '0.16em', color: T.mint, marginTop: 6 }}>
          EVERY CHAIN
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          position: 'relative',
          border: `1.5px solid ${T.mint}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            border: `1.5px solid ${T.violet}`,
            borderTopColor: 'transparent',
            transform: 'rotate(45deg)',
          }}
        />
      </span>
      <span className="numeric" style={{ fontWeight: 600, fontSize: 15, letterSpacing: '0.12em', color: T.text }}>
        RECURRA
      </span>
    </div>
  );
}

function Nav({ onLaunch }: { onLaunch: () => void }) {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 28px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        background: T.cardGlass,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <Logo />
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {['How it works', 'Discover', 'Docs'].map((l) => (
          <span
            key={l}
            style={{ fontSize: 14, color: T.dim, cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.dim)}
          >
            {l}
          </span>
        ))}
        <button
          onClick={onLaunch}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: T.launchBg,
            color: T.launchText,
            border: 'none',
            borderRadius: 9,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Launch App
        </button>
      </div>
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
        @keyframes wave { from { r: 52px; opacity: 0.7; } to { r: 156px; opacity: 0; } }
        @keyframes flow { to { stroke-dashoffset: -12; } }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes starTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.6; } }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: i % 3 === 0 ? T.mint : T.violetLight,
              opacity: 0.3,
              animation: `starTwinkle ${3 + (i % 4)}s ease-in-out infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, transparent, ${T.bg} 75%)`,
          pointerEvents: 'none',
        }}
      />

      <Nav onLaunch={launch} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '72px 24px 48px',
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
            borderRadius: 20,
            marginBottom: 22,
            border: `1px solid ${T.border}`,
            background: T.card,
            fontSize: 12,
            color: T.dim,
            letterSpacing: '0.08em',
            animation: 'fadeUp 0.8s ease both',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.mint,
              boxShadow: `0 0 8px ${T.mint}`,
            }}
          />
          POWERED BY EIP-7702 · PARTICLE UNIVERSAL ACCOUNTS
        </div>

        <div style={{ animation: 'fadeUp 1s ease both 0.1s' }}>
          <HeroOrb />
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 58px)',
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            margin: '14px 0 0',
            maxWidth: 780,
            animation: 'fadeUp 1s ease both 0.2s',
          }}
        >
          Recurring payments, <span style={{ color: T.mint }}>finally invisible.</span>
        </h1>

        <p
          style={{
            fontSize: 16.5,
            color: T.dim,
            maxWidth: 520,
            margin: '14px 0 0',
            lineHeight: 1.55,
            animation: 'fadeUp 1s ease both 0.3s',
          }}
        >
          Fund once. Approve once. Pay forever — across any chain, on any schedule, without ever signing again.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 26, animation: 'fadeUp 1s ease both 0.4s' }}>
          <button
            onClick={launch}
            style={{
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 600,
              background: T.mint,
              color: T.ctaText,
              border: 'none',
              borderRadius: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 8px 30px -8px ${T.mint}`,
            }}
          >
            Start subscribing →
          </button>
          <button
            style={{
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 600,
              background: 'transparent',
              color: T.text,
              border: `1px solid ${T.borderBright}`,
              borderRadius: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ color: T.mint }}>▶</span> Watch demo
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 26,
            marginTop: 36,
            flexWrap: 'wrap',
            justifyContent: 'center',
            animation: 'fadeUp 1s ease both 0.5s',
          }}
        >
          {['Magic', 'ZeroDev', 'Openfort', 'Particle', 'Arbitrum'].map((n) => (
            <span key={n} className="numeric" style={{ fontSize: 13, color: T.faint, letterSpacing: '0.06em' }}>
              {n}
            </span>
          ))}
        </div>
      </div>

      <div
        className="numeric"
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          color: T.faint,
          letterSpacing: '0.15em',
          zIndex: 10,
        }}
      >
        SCROLL TO EXPLORE
      </div>
    </div>
  );
}
