// The night sky — twinkling stars plus (optionally) a couple of small shaded
// planets with pulsing atmosphere shells. Same visual language as the
// landing, packaged for any screen that wants the universe behind it.
export function Starfield({ stars = 40, planets = true }: { stars?: number; planets?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes sfTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.6; } }
        @keyframes sfDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(7px,-11px); } }
        @keyframes sfGlow { 0%,100% { opacity: 0.26; } 50% { opacity: 0.46; } }
        @keyframes sfWave { 0% { transform: scale(1); opacity: 0.38; } 65% { transform: scale(2.6); opacity: 0; } 100% { transform: scale(2.6); opacity: 0; } }
      `}</style>

      {Array.from({ length: stars }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            width: i % 5 === 0 ? 2.5 : 1.5,
            height: i % 5 === 0 ? 2.5 : 1.5,
            borderRadius: '50%',
            background: i % 4 === 0 ? 'var(--mint)' : i % 4 === 1 ? 'var(--violet-light)' : 'var(--ink)',
            opacity: 0.22,
            animation: `sfTwinkle ${3 + (i % 4)}s ease-in-out infinite ${i * 0.2}s`,
          }}
        />
      ))}

      {planets &&
        (
          [
            { left: '12%', top: '16%', size: 9, color: 'var(--violet-light)', ring: true, dur: 24 },
            { left: '82%', top: '74%', size: 11, color: 'var(--mint)', ring: false, dur: 30 },
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
              animation: `sfDrift ${p.dur}s ease-in-out infinite ${i * 2.1}s, sfGlow ${7 + i * 3}s ease-in-out infinite ${i * 1.3}s`,
            }}
          >
            <defs>
              <radialGradient id={`sf-light-${i}`} cx="34%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`sf-clip-${i}`}>
                <circle cx="20" cy="20" r="7" />
              </clipPath>
            </defs>

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
                animation: `sfWave ${11 + i * 4}s ease-out infinite ${i * 2.3}s`,
              }}
            />
            <circle cx="20" cy="20" r="7" fill={p.color} opacity="0.75" />
            <circle cx="20" cy="20" r="7" fill={`url(#sf-light-${i})`} />
            <circle cx="23.4" cy="23.2" r="7.4" fill="#06070B" opacity="0.6" clipPath={`url(#sf-clip-${i})`} />
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
  );
}
