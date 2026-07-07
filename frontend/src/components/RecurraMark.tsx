import { useId } from 'react';

// The Recurra mark, recreated as a vector from the brand logo
// (~/Pictures/recurra02.jpg): loose green threads gather into a thick
// sweep, thin into a literal chain of links, and come around as an
// arrow — recurrence, made of links. Recolored to the app tokens
// (mint → violet) for the dark canvas.
//
// If the designer's original SVG export lands in public/, swap the
// internals of this component for it — the API stays the same.
export function RecurraMark({
  size = 28,
  spin = false,
  className = '',
}: {
  size?: number;
  spin?: boolean;
  className?: string;
}) {
  const gid = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={spin ? { animation: 'markSpin 48s linear infinite' } : undefined}
      aria-label="Recurra"
    >
      {spin && <style>{`@keyframes markSpin { to { transform: rotate(360deg); } }`}</style>}
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="50.8" y1="45.2" x2="15.7" y2="15.7">
          <stop offset="0%" stopColor="var(--mint)" />
          <stop offset="60%" stopColor="var(--violet-light)" />
          <stop offset="100%" stopColor="var(--violet)" />
        </linearGradient>
      </defs>

      {/* loose threads at the tail — before the chain gathers */}
      <path d="M50.8 45.2 Q58 40 62.5 36.5" stroke="var(--mint)" strokeWidth="1.1" opacity="0.85" strokeLinecap="round" />
      <path d="M51.6 43.4 Q58.5 37.5 61.5 31.5" stroke="var(--mint)" strokeWidth="1" opacity="0.55" strokeLinecap="round" />
      <path d="M52.2 41.6 Q58 35.5 60 28.5" stroke="var(--mint)" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" />

      {/* the gathered sweep: thick through bottom and left */}
      <path
        d="M50.84 45.19 A23 23 0 1 1 15.74 15.74"
        stroke={`url(#${gid})`}
        strokeWidth="4.2"
        strokeLinecap="round"
      />

      {/* the sweep thins into a chain along the top */}
      <path d="M15.74 15.74 A23 23 0 0 1 39.1 10.1" stroke="var(--violet-light)" strokeWidth="1.2" />

      {/* the links of that chain */}
      <ellipse cx="22.3" cy="11.2" rx="2.2" ry="1.3" stroke="var(--violet-light)" strokeWidth="0.9" transform="rotate(-25 22.3 11.2)" fill="#06070B" />
      <ellipse cx="28.8" cy="9.2" rx="2.2" ry="1.3" stroke="var(--violet-light)" strokeWidth="0.9" transform="rotate(-8 28.8 9.2)" fill="#06070B" />
      <ellipse cx="35.2" cy="9.2" rx="2.2" ry="1.3" stroke="var(--violet-light)" strokeWidth="0.9" transform="rotate(8 35.2 9.2)" fill="#06070B" />

      {/* faint links riding the thick arc */}
      <ellipse cx="12.1" cy="43.5" rx="2" ry="1.2" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" transform="rotate(60 12.1 43.5)" />
      <ellipse cx="9.3" cy="28" rx="2" ry="1.2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" transform="rotate(100 9.3 28)" />

      {/* the arrowhead — the cycle comes around (slightly detached, like the mark) */}
      <g transform="translate(42.6 10.6) rotate(10)">
        <path d="M0 -5 L8.4 0 L0 5 L2.6 0 Z" fill="var(--violet)" />
      </g>
    </svg>
  );
}
