'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Galaxy } from '@/components/Galaxy';
import { RecurraMark } from '@/components/RecurraMark';
import { TwoSides } from '@/components/landing/TwoSides';
import { Lifecycle } from '@/components/landing/Lifecycle';
import { BuiltOn } from '@/components/landing/BuiltOn';
import { Footer } from '@/components/landing/Footer';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { T } from '@/components/landing/tokens';

// ─────────────────────────────────────────────────────────────
// Recurra — landing. Pure black. The only light comes from the
// stars, the little drifting planets, and one monochrome spiral
// galaxy burning on the hero's right. Wordmark + copy on the left.
// No color, anywhere, ever.
// ─────────────────────────────────────────────────────────────

// deterministic pseudo-random — integer bit-mixing only. Math.sin-based
// hashes differ by an ULP between Node's and Chrome's V8 for large
// arguments, which hydration-mismatches every star; integer ops are
// exact in IEEE754 on every engine.
function rand(i: number, salt: number): number {
  let t = (i * 374761393 + salt * 668265263) >>> 0;
  t = (t ^ (t >>> 13)) >>> 0;
  t = (t * 1274126177) >>> 0;
  t = (t ^ (t >>> 16)) >>> 0;
  return t / 4294967296;
}

// round to 3 decimals — kills cross-engine trig ULP noise before it can
// hydration-mismatch, and keeps the SSR HTML small
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// the deep field — the sky IS the lighting now, so it runs a touch
// brighter than before. Sizes and brightness vary; all deterministic.
const STARS = Array.from({ length: 150 }, (_, i) => ({
  left: r3(rand(i, 1) * 100),
  top: r3(rand(i, 2) * 100),
  size: rand(i, 3) < 0.07 ? 2.6 : rand(i, 3) < 0.5 ? 1.7 : 1.1,
  opacity: r3(0.14 + rand(i, 4) * 0.45),
  dur: r3(2.5 + rand(i, 5) * 4),
  delay: r3(rand(i, 6) * 6),
}));

// two quiet four-point glints far from the hero's focal corners
const FLARES = [
  { left: '10%', top: '26%', size: 44, opacity: 0.55, dur: 9 },
  { left: '58%', top: '84%', size: 56, opacity: 0.5, dur: 11 },
] as const;

// little planets — lit spheres, not discs. Monochrome; alternating ones
// go crescent-dominant (mostly dark, bright rim). EVERY planet wears a
// ring, and the ring is what pulses — the body itself holds still.
// tilt varies per planet so no two rings sit at the same angle.
// Module scope so the scroll-parallax effect can read sizes without
// recreating the array.
// planet shades — deliberately dimmer than the stars and far dimmer than
// the galaxy; the planets are furniture of the dark, not light sources
const SHADE = {
  bright: 'rgba(255,255,255,0.5)',
  mid: 'rgba(255,255,255,0.4)',
  dim: 'rgba(255,255,255,0.3)',
} as const;

const PLANETS = [
  { left: '9%', top: '18%', size: 10, color: SHADE.mid, tilt: -18, band: false, dur: 6 },
  { left: '86%', top: '13%', size: 7, color: SHADE.dim, tilt: 10, band: true, dur: 7 },
  { left: '78%', top: '72%', size: 12, color: SHADE.mid, tilt: -26, band: false, dur: 8 },
  { left: '14%', top: '76%', size: 6, color: SHADE.bright, tilt: 22, band: false, dur: 6.5 },
  { left: '68%', top: '32%', size: 5, color: SHADE.dim, tilt: -8, band: false, dur: 7.5 },
  { left: '28%', top: '38%', size: 8, color: SHADE.mid, tilt: 16, band: true, dur: 9 },
  { left: '46%', top: '10%', size: 6, color: SHADE.dim, tilt: -30, band: false, dur: 8.5 },
  { left: '93%', top: '40%', size: 8, color: SHADE.mid, tilt: 6, band: false, dur: 9.5 },
  { left: '38%', top: '86%', size: 9, color: SHADE.bright, tilt: -14, band: true, dur: 7 },
  { left: '5%', top: '54%', size: 5, color: SHADE.dim, tilt: 26, band: false, dur: 8 },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const launch = () => router.push('/login');

  // Scroll parallax — stars barely shift; planets drift further per pixel
  // scrolled the bigger (closer) they are, so the depth is real.
  const starLayerRef = useRef<HTMLDivElement>(null);
  const planetRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (starLayerRef.current) {
          starLayerRef.current.style.transform = `translateY(${y * 0.02}px)`;
        }
        planetRefs.current.forEach((el, i) => {
          if (!el) return;
          const factor = 0.04 + (PLANETS[i].size / 12) * 0.14;
          el.style.transform = `translateY(${y * factor}px)`;
        });
        frame = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        position: 'relative',
      }}
    >
      {/* fadeUp comes from globals.css — shared with login + the app shell */}
      <style>{`
        @keyframes starTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.6; } }
        @keyframes flarePulse { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.12); opacity: 1; } }
        @keyframes galaxySpin { to { transform: rotate(360deg); } }
        @keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(34px,-44px); } }
        @keyframes ringPulse { 0%,100% { transform: scale(1); opacity: 0.18; } 50% { transform: scale(1.16); opacity: 0.5; } }
        @keyframes scrollNudge { 0%,100% { transform: translateY(0); opacity: 0.45; } 50% { transform: translateY(5px); opacity: 0.9; } }
      `}</style>

      {/* the universe — fixed, pure black. Only stars, glints, and the
          little planets emit light back here. */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div ref={starLayerRef} style={{ position: 'absolute', inset: 0 }}>
          {STARS.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                background: T.text,
                opacity: s.opacity,
                animation: `starTwinkle ${s.dur}s ease-in-out infinite ${s.delay}s`,
              }}
            />
          ))}
          {FLARES.map((f, i) => (
            <div key={`f-${i}`} style={{ position: 'absolute', left: f.left, top: f.top, transform: 'translate(-50%, -50%)' }}>
              <svg
                width={f.size}
                height={f.size}
                viewBox="0 0 100 100"
                style={{ display: 'block', opacity: f.opacity, animation: `flarePulse ${f.dur}s ease-in-out infinite` }}
              >
                <defs>
                  <radialGradient id={`flare-core-${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                    <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="26" fill={`url(#flare-core-${i})`} />
                <polygon points="50,2 51.6,50 50,98 48.4,50" fill="#FFFFFF" opacity="0.8" />
                <polygon points="14,50 50,48.6 86,50 50,51.4" fill="#FFFFFF" opacity="0.65" />
                <circle cx="50" cy="50" r="2.4" fill="#FFFFFF" />
              </svg>
            </div>
          ))}
        </div>

        {PLANETS.map((p, i) => (
          <div
            key={i}
            ref={(el) => {
              planetRefs.current[i] = el;
            }}
            style={{ position: 'absolute', left: p.left, top: p.top }}
          >
            <svg
              width={p.size * 4}
              height={p.size * 4}
              viewBox="0 0 40 40"
              style={{
                overflow: 'visible',
                animation: `drift ${p.dur}s ease-in-out infinite ${i * 1.7}s`,
              }}
            >
              <defs>
                <radialGradient id={`p-light-${i}`} cx="34%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.38" />
                  <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>
                <clipPath id={`p-clip-${i}`}>
                  <circle cx="20" cy="20" r="7" />
                </clipPath>
              </defs>

              {/* body */}
              <circle cx="20" cy="20" r="7" fill={p.color} opacity="0.55" />
              {/* sunlit side */}
              <circle cx="20" cy="20" r="7" fill={`url(#p-light-${i})`} />
              {/* surface band (latitude stripe) */}
              {p.band && (
                <path
                  d="M13.2 18.4 Q20 21.8 26.8 18.1"
                  fill="none"
                  stroke={T.bg}
                  strokeWidth="1.1"
                  opacity="0.35"
                  clipPath={`url(#p-clip-${i})`}
                />
              )}
              {/* night side — offset dark sphere clipped to the body = crescent.
                  Alternating planets go crescent-dominant like eclipsed moons. */}
              <circle
                cx={i % 2 === 0 ? '22.6' : '23.4'}
                cy={i % 2 === 0 ? '22.4' : '23.2'}
                r="7.4"
                fill={T.bg}
                opacity={i % 2 === 0 ? 0.92 : 0.6}
                clipPath={`url(#p-clip-${i})`}
              />
              {/* limb */}
              <circle cx="20" cy="20" r="7" fill="none" stroke={p.color} strokeWidth="0.6" opacity="0.5" />

              {/* the rings — every planet wears them, and THEY carry the
                  pulse: a slow swell and brighten, staggered per planet,
                  while the body underneath never moves */}
              <g transform={`rotate(${p.tilt} 20 20)`}>
                <g
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    animation: `ringPulse ${7 + (i % 4) * 2}s ease-in-out infinite ${i * 1.3}s`,
                  }}
                >
                  <ellipse cx="20" cy="20" rx="12.5" ry="4.2" fill="none" stroke={p.color} strokeWidth="0.75" />
                  <ellipse cx="20" cy="20" rx="10.5" ry="3.4" fill="none" stroke={p.color} strokeWidth="0.4" opacity="0.55" />
                </g>
              </g>
            </svg>
          </div>
        ))}
      </div>

      <ScrollProgress />

      {/* no navbar at all — just the mark, floating alone top-left,
          slowly spinning. It doubles as back-to-top. The universe owns
          every other pixel of the top edge. The scrim dissolves scrolled
          content into black before it can hard-clip at the viewport top;
          over the hero it's black-on-black, invisible. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 130,
          zIndex: 15,
          pointerEvents: 'none',
          background: 'linear-gradient(#000 8%, rgba(0,0,0,0.75) 45%, transparent)',
        }}
      />
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        aria-label="Back to top"
        style={{
          position: 'fixed',
          top: 22,
          left: 'clamp(20px, 4vw, 48px)',
          zIndex: 20,
          display: 'flex',
          lineHeight: 0,
        }}
      >
        <RecurraMark size={30} spin />
      </a>

      {/* hero — the name and the promise on the left, the galaxy burning
          on the right. */}
      <section
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 'clamp(24px, 4vw, 56px)',
          padding: '110px 24px 60px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            maxWidth: 560,
            minWidth: 300,
            flex: '1 1 380px',
            animation: 'fadeUp 1s ease both',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: 'clamp(34px, 4.4vw, 58px)',
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              margin: 0,
              color: T.text,
              animation: 'fadeUp 1s ease both 0.15s',
            }}
          >
            Recurra
          </h1>

          <div
            style={{
              width: 44,
              height: 1,
              background: 'rgba(255,255,255,0.35)',
              margin: '26px 0 18px',
              animation: 'fadeUp 1s ease both 0.3s',
            }}
          />

          {/* the selling point — bright enough to sell. Raised after a
              live readability review; these two lines ARE the pitch. */}
          <p
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: T.text,
              letterSpacing: '0.3em',
              margin: 0,
              textTransform: 'uppercase',
              textShadow: '0 0 24px rgba(255,255,255,0.25)',
              animation: 'fadeUp 1s ease both 0.4s',
            }}
          >
            Payments that run themselves
          </p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.24em',
              margin: '12px 0 0',
              textTransform: 'uppercase',
              animation: 'fadeUp 1s ease both 0.5s',
            }}
          >
            Fund once · Approve once · Pay forever
          </p>

          <button
            onClick={launch}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = '#FFFFFF';
              el.style.color = '#000000';
              el.style.borderColor = '#FFFFFF';
              el.style.boxShadow = '0 6px 32px -6px rgba(255,255,255,0.45)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = T.cardGlass;
              el.style.color = T.text;
              el.style.borderColor = 'rgba(255,255,255,0.4)';
              el.style.boxShadow = 'none';
            }}
            style={{
              marginTop: 34,
              padding: '13px 42px',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.24em',
              textIndent: '0.24em',
              textTransform: 'uppercase',
              background: T.cardGlass,
              color: T.text,
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 999,
              cursor: 'pointer',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
              animation: 'fadeUp 1s ease both 0.6s',
            }}
          >
            Launch app
          </button>
        </div>

        <div style={{ flex: '0 1 auto', animation: 'fadeUp 1.2s ease both 0.25s' }}>
          <Galaxy width={560} />
        </div>

        {/* scroll cue — pinned to the hero's bottom edge */}
        <div
          style={{
            position: 'absolute',
            bottom: 26,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              fontSize: 10.5,
              fontWeight: 400,
              letterSpacing: '0.28em',
              color: T.dim,
              animation: 'fadeUp 1s ease both 0.9s',
            }}
          >
            SCROLL TO EXPLORE
            <svg width="12" height="7" viewBox="0 0 12 7" style={{ animation: 'scrollNudge 2.6s ease-in-out infinite' }}>
              <path d="M1 1 L6 6 L11 1" fill="none" stroke={T.dim} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      <div id="how">
        <TwoSides />
      </div>
      <Lifecycle />
      <div id="stack">
        <BuiltOn />
      </div>
      <Footer />

    </div>
  );
}
