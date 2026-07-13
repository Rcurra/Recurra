// The night sky — pure black & white. Twinkling stars of varied size and
// brightness plus (optionally) a few small ringed planets. Same visual
// language as the landing: every planet wears a tilted ring, and the ring
// is what pulses — the body holds still. Packaged for any screen that
// wants the universe behind it.

// deterministic pseudo-random — integer bit-mixing only (trig-based hashes
// hydration-mismatch between Node's and Chrome's V8)
function rand(i: number, salt: number): number {
  let t = (i * 374761393 + salt * 668265263) >>> 0;
  t = (t ^ (t >>> 13)) >>> 0;
  t = (t * 1274126177) >>> 0;
  t = (t ^ (t >>> 16)) >>> 0;
  return t / 4294967296;
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

const SHADE = {
  bright: 'rgba(255,255,255,0.5)',
  mid: 'rgba(255,255,255,0.4)',
  dim: 'rgba(255,255,255,0.3)',
} as const;

const PLANETS = [
  { left: '12%', top: '16%', size: 9, color: SHADE.mid, tilt: -18, dur: 6.5 },
  { left: '82%', top: '74%', size: 11, color: SHADE.dim, tilt: 14, dur: 7.5 },
  { left: '68%', top: '10%', size: 6, color: SHADE.dim, tilt: -26, dur: 8 },
  { left: '6%', top: '62%', size: 7, color: SHADE.mid, tilt: 20, dur: 7 },
  { left: '90%', top: '38%', size: 5, color: SHADE.dim, tilt: -10, dur: 8.5 },
  { left: '30%', top: '88%', size: 8, color: SHADE.mid, tilt: -22, dur: 6.8 },
] as const;

// shooting stars — long cycles so a streak is an event, not a pattern.
// Each fires for ~1s of its cycle, from its own corner of the sky.
const METEORS = [
  { left: '72%', top: '6%', cycle: 13, delay: 3 },
  { left: '34%', top: '-2%', cycle: 19, delay: 10 },
  { left: '90%', top: '22%', cycle: 27, delay: 17 },
] as const;

// nebula dust — faint white breath along the belt, pure texture. What
// makes the reference sky feel deep isn't objects, it's atmosphere.
const DUST = Array.from({ length: 9 }, (_, i) => ({
  left: r3(rand(i, 21) * 104 - 2),
  top: r3(36 + rand(i, 22) * 26),
  size: r3(140 + rand(i, 23) * 240),
  opacity: r3(0.018 + rand(i, 24) * 0.022),
  blur: r3(36 + rand(i, 25) * 36),
}));

// two quiet four-point glints for the far corners of the belt
const GLINTS = [
  { left: '14%', top: '30%', size: 40, opacity: 0.5, dur: 9 },
  { left: '87%', top: '62%', size: 52, opacity: 0.45, dur: 12 },
] as const;

export function Starfield({
  stars = 80,
  planets = true,
  shootingStars = false,
  orbit = false,
  nebula = false,
}: {
  stars?: number;
  planets?: boolean;
  shootingStars?: boolean;
  orbit?: boolean;
  nebula?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes sfTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.6; } }
        @keyframes sfDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(34px,-44px); } }
        @keyframes sfRingPulse { 0%,100% { transform: scale(1); opacity: 0.18; } 50% { transform: scale(1.16); opacity: 0.5; } }
        @keyframes sfShoot {
          0% { transform: translate(0, 0); opacity: 0; }
          2% { opacity: 0.9; }
          7% { transform: translate(-560px, 340px); opacity: 0; }
          100% { transform: translate(-560px, 340px); opacity: 0; }
        }
        @keyframes sfOrbit { 0% { offset-distance: 0%; } 100% { offset-distance: 100%; } }
        @keyframes sfMoonDepth {
          0%   { opacity: 0.55; transform: scale(0.9); }
          25%  { opacity: 0.95; transform: scale(1.15); }
          50%  { opacity: 0.55; transform: scale(0.9); }
          75%  { opacity: 0.28; transform: scale(0.65); }
          100% { opacity: 0.55; transform: scale(0.9); }
        }
      `}</style>

      {/* the orbit — a ringed planet with a small moon actually circling
          it: brighter and bigger swinging across the front, dim and small
          slipping behind. The one object in the sky with a full visible
          cycle; everything else just breathes. */}
      {orbit && (
        <div
          style={{
            position: 'absolute',
            right: '7%',
            top: '12%',
            width: 168,
            height: 140,
            transform: 'rotate(-12deg)',
          }}
        >
          <svg width="168" height="140" viewBox="0 0 168 140" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <radialGradient id="sf-orbit-light" cx="34%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
              <clipPath id="sf-orbit-clip">
                <circle cx="84" cy="70" r="15" />
              </clipPath>
            </defs>
            {/* the orbit line itself — barely-there, like a chart of what
                the moon is doing */}
            <ellipse cx="84" cy="70" rx="56" ry="17" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.6" />
            {/* body */}
            <circle cx="84" cy="70" r="15" fill={SHADE.mid} opacity="0.55" />
            <circle cx="84" cy="70" r="15" fill="url(#sf-orbit-light)" />
            <circle cx="89.5" cy="75" r="15.8" fill="#000000" opacity="0.6" clipPath="url(#sf-orbit-clip)" />
            <circle cx="84" cy="70" r="15" fill="none" stroke={SHADE.mid} strokeWidth="0.6" opacity="0.5" />
            {/* ring, pulsing like every other planet's */}
            <g transform="rotate(-20 84 70)">
              <g
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: 'sfRingPulse 9s ease-in-out infinite',
                }}
              >
                <ellipse cx="84" cy="70" rx="26" ry="8.6" fill="none" stroke={SHADE.mid} strokeWidth="0.9" />
                <ellipse cx="84" cy="70" rx="22" ry="7" fill="none" stroke={SHADE.mid} strokeWidth="0.5" opacity="0.55" />
              </g>
            </g>
          </svg>
          {/* the moon — rides the ellipse; front pass bright, back pass faint */}
          <div
            style={{
              position: 'absolute',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #FFFFFF, rgba(255,255,255,0.5))',
              boxShadow: '0 0 5px rgba(255,255,255,0.4)',
              offsetPath: 'path("M 28 70 a 56 17 0 1 0 112 0 a 56 17 0 1 0 -112 0")',
              animation: 'sfOrbit 16s linear infinite, sfMoonDepth 16s linear infinite',
            }}
          />
        </div>
      )}

      {/* shooting stars — the head leads, the tail dissolves behind it */}
      {shootingStars &&
        METEORS.map((m, i) => (
          <div
            key={`m-${i}`}
            style={{
              position: 'absolute',
              left: m.left,
              top: m.top,
              opacity: 0,
              animation: `sfShoot ${m.cycle}s linear infinite ${m.delay}s`,
            }}
          >
            <div
              style={{
                width: 140,
                height: 1.8,
                borderRadius: 999,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55) 70%, #FFFFFF)',
                transform: 'rotate(148.7deg)',
                boxShadow: '0 0 6px rgba(255,255,255,0.35)',
              }}
            />
          </div>
        ))}

      {/* the dust belt — a soft diagonal river of texture behind
          everything; the glass frosts against it */}
      {nebula && (
        <div
          aria-hidden
          style={{ position: 'absolute', inset: '-10%', transform: 'rotate(-8deg)' }}
        >
          {DUST.map((d, i) => (
            <div
              key={`d-${i}`}
              style={{
                position: 'absolute',
                left: `${d.left}%`,
                top: `${d.top}%`,
                width: d.size,
                height: d.size * 0.55,
                borderRadius: '50%',
                background: `radial-gradient(ellipse, rgba(255,255,255,${d.opacity}), transparent 68%)`,
                filter: `blur(${d.blur}px)`,
              }}
            />
          ))}
        </div>
      )}

      {nebula &&
        GLINTS.map((f, i) => (
          <svg
            key={`g-${i}`}
            width={f.size}
            height={f.size}
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              left: f.left,
              top: f.top,
              opacity: f.opacity,
              animation: `sfRingPulse ${f.dur}s ease-in-out infinite ${i * 2.7}s`,
            }}
          >
            <polygon points="50,4 51.5,50 50,96 48.5,50" fill="#FFFFFF" opacity="0.8" />
            <polygon points="16,50 50,48.7 84,50 50,51.3" fill="#FFFFFF" opacity="0.6" />
            <circle cx="50" cy="50" r="2.2" fill="#FFFFFF" />
          </svg>
        ))}

      {Array.from({ length: stars }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${r3(rand(i, 1) * 100)}%`,
            top: `${r3(
              // with the nebula on, every third star settles into the
              // belt's latitudes — the sky is densest along the river
              nebula && i % 3 === 0 ? 40 + rand(i, 2) * 22 : rand(i, 2) * 100,
            )}%`,
            // most of the sky is faraway dust — tiny and faint; the
            // occasional near star is big and bright
            width: rand(i, 3) < 0.05 ? 2.4 : rand(i, 3) < 0.3 ? 1.6 : rand(i, 3) < 0.65 ? 1.1 : 0.7,
            height: rand(i, 3) < 0.05 ? 2.4 : rand(i, 3) < 0.3 ? 1.6 : rand(i, 3) < 0.65 ? 1.1 : 0.7,
            borderRadius: '50%',
            background: 'var(--ink)',
            opacity: r3(rand(i, 3) < 0.65 ? 0.14 + rand(i, 4) * 0.45 : 0.1 + rand(i, 4) * 0.25),
            animation: `sfTwinkle ${r3(2.5 + rand(i, 5) * 4)}s ease-in-out infinite ${r3(rand(i, 6) * 6)}s`,
          }}
        />
      ))}

      {planets &&
        PLANETS.map((p, i) => (
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
              animation: `sfDrift ${p.dur}s ease-in-out infinite ${i * 2.1}s`,
            }}
          >
            <defs>
              <radialGradient id={`sf-light-${i}`} cx="34%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.38" />
                <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`sf-clip-${i}`}>
                <circle cx="20" cy="20" r="7" />
              </clipPath>
            </defs>

            {/* body */}
            <circle cx="20" cy="20" r="7" fill={p.color} opacity="0.55" />
            {/* sunlit side */}
            <circle cx="20" cy="20" r="7" fill={`url(#sf-light-${i})`} />
            {/* night side — alternating planets go crescent-dominant */}
            <circle
              cx={i % 2 === 0 ? '22.6' : '23.4'}
              cy={i % 2 === 0 ? '22.4' : '23.2'}
              r="7.4"
              fill="#000000"
              opacity={i % 2 === 0 ? 0.92 : 0.6}
              clipPath={`url(#sf-clip-${i})`}
            />
            {/* limb */}
            <circle cx="20" cy="20" r="7" fill="none" stroke={p.color} strokeWidth="0.6" opacity="0.5" />

            {/* the ring — every planet wears one, and IT carries the pulse */}
            <g transform={`rotate(${p.tilt} 20 20)`}>
              <g
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `sfRingPulse ${7 + i * 2}s ease-in-out infinite ${i * 1.3}s`,
                }}
              >
                <ellipse cx="20" cy="20" rx="12.5" ry="4.2" fill="none" stroke={p.color} strokeWidth="0.75" />
                <ellipse cx="20" cy="20" rx="10.5" ry="3.4" fill="none" stroke={p.color} strokeWidth="0.4" opacity="0.55" />
              </g>
            </g>
          </svg>
        ))}
    </div>
  );
}
