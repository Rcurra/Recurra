// The galaxy — monochrome spiral, built for photographic density (the
// Pinterest reference: grainy arms, dust, a burning core). Three layers
// of matter along two logarithmic arms:
//   1. grain  — hundreds of fine faint dots, the film-grain body
//   2. sparks — sparser, brighter, bigger dots riding the same arms
//   3. dust   — small blurred clumps, the smoke between the stars
// plus a disc haze underneath and a layered core bloom. The disc spins
// in its own plane, slow enough to be felt only.

function rand(i: number, salt: number): number {
  let t = (i * 374761393 + salt * 668265263) >>> 0;
  t = (t ^ (t >>> 13)) >>> 0;
  t = (t * 1274126177) >>> 0;
  t = (t ^ (t >>> 16)) >>> 0;
  return t / 4294967296;
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

type Dot = { x: number; y: number; r: number; o: number };

// dots along a two-armed logarithmic spiral in a 400×400 space,
// jitter widening outward so the arms fray at the edges like the real thing
function armDots(count: number, salt: number, jitterScale: number, rMin: number, rMax: number, oMax: number): Dot[] {
  const dots: Dot[] = [];
  for (let arm = 0; arm < 2; arm++) {
    for (let j = 0; j < count / 2; j++) {
      const i = arm * 5000 + j;
      const t = rand(i, salt);
      const theta = t * Math.PI * 3.3 + arm * Math.PI;
      const radius = 12 + 176 * Math.pow(t, 0.82);
      const jitter = (rand(i, salt + 1) - 0.5) * (8 + jitterScale * t);
      dots.push({
        x: r3(200 + (radius + jitter) * Math.cos(theta)),
        y: r3(200 + (radius + jitter) * Math.sin(theta)),
        r: r3(rMin + rand(i, salt + 2) * (rMax - rMin)),
        o: r3(Math.max(0.06, oMax - t * oMax * 0.55) * (0.4 + rand(i, salt + 3) * 0.6)),
      });
    }
  }
  return dots;
}

const GRAIN = armDots(680, 41, 44, 0.3, 0.9, 0.65);
const SPARKS = armDots(150, 51, 30, 0.9, 1.9, 0.85);
const DUST_CLUMPS = armDots(26, 61, 22, 6, 15, 0.09);

export function Galaxy({
  width,
  tilt = -16,
  flatten = 0.42,
  spin = 240,
  brightness = 1,
  blade = true,
}: {
  width: number;
  tilt?: number;
  flatten?: number;
  spin?: number;
  brightness?: number;
  blade?: boolean;
}) {
  const height = width * 0.62;
  return (
    <div style={{ position: 'relative', width, height, pointerEvents: 'none', opacity: brightness }}>
      <style>{`
        @keyframes galaxySpin { to { transform: rotate(360deg); } }
        @keyframes flarePulse { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.12); opacity: 1; } }
      `}</style>

      {/* the disc — tilted into perspective, spinning in its own plane */}
      <svg
        width={width}
        height={width}
        viewBox="0 0 400 400"
        style={{
          position: 'absolute',
          left: 0,
          top: (height - width) / 2,
          transform: `rotate(${tilt}deg) scaleY(${flatten})`,
          overflow: 'visible',
        }}
      >
        <defs>
          <radialGradient id="gal-haze" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gal-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gal-bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animation: `galaxySpin ${spin}s linear infinite`,
          }}
        >
          {/* disc haze */}
          <circle cx="200" cy="200" r="192" fill="url(#gal-haze)" />
          {/* dust clumps — the smoke */}
          <g style={{ filter: 'blur(5px)' }}>
            {DUST_CLUMPS.map((d, i) => (
              <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#FFFFFF" opacity={d.o} />
            ))}
          </g>
          {/* the grain — the arms' film-texture body */}
          {GRAIN.map((d, i) => (
            <circle key={`g-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#FFFFFF" opacity={d.o} />
          ))}
          {/* the sparks — brighter matter riding the arms */}
          {SPARKS.map((d, i) => (
            <circle key={`s-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#FFFFFF" opacity={d.o} />
          ))}
          {/* core bloom, layered — wide glow then the burning center */}
          <circle cx="200" cy="200" r="95" fill="url(#gal-bloom)" />
          <circle cx="200" cy="200" r="48" fill="url(#gal-core)" />
        </g>
      </svg>

      {/* the core flare — perpendicular to the disc, outside the flatten
          so it stays a clean vertical blade of light */}
      {blade && (
        <svg
          width={width * 0.5}
          height={height}
          viewBox="0 0 100 200"
          style={{
            position: 'absolute',
            left: width * 0.25,
            top: 0,
            animation: 'flarePulse 9s ease-in-out infinite',
          }}
        >
          <defs>
            <radialGradient id="gal-flare-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="100" r="34" fill="url(#gal-flare-glow)" />
          <polygon points="50,22 51.8,100 50,178 48.2,100" fill="#FFFFFF" opacity="0.85" />
          <polygon points="26,100 50,98.6 74,100 50,101.4" fill="#FFFFFF" opacity="0.5" />
          <circle cx="50" cy="100" r="2.6" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  );
}
