import { useId } from 'react';

// The vault door — a safe's face, drawn in the app's own language:
// gradient outer ring (same mint→violet as CadenceRing), riveted rim,
// and a three-spoke handle. The handle group carries `vault-handle` so
// a parent with `group` can rotate it on hover (transform-box makes the
// rotation happen around the door's own center — same technique as the
// landing planets' pulse shells).
export function VaultDoor({ size = 88, className = '' }: { size?: number; className?: string }) {
  const gid = useId();
  const rivets = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    return { cx: 40 + 30 * Math.cos(angle), cy: 40 + 30 * Math.sin(angle) };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--mint)" />
          <stop offset="100%" stopColor="var(--violet)" />
        </linearGradient>
      </defs>

      {/* door body */}
      <circle cx="40" cy="40" r="35" fill="var(--surface-2)" />
      {/* outer ring */}
      <circle cx="40" cy="40" r="35" fill="none" stroke={`url(#${gid})`} strokeWidth="2.5" />
      {/* rivets on the rim */}
      {rivets.map((r, i) => (
        <circle key={i} cx={r.cx} cy={r.cy} r="1.4" fill="var(--ink-faint)" />
      ))}
      {/* inner ring — the door within the frame */}
      <circle cx="40" cy="40" r="23" fill="none" stroke="var(--line)" strokeWidth="1.5" />

      {/* the handle: hub + three spokes, rotates on parent group-hover */}
      <g
        className="transition-transform duration-500 ease-out group-hover:rotate-45"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        {/* -90 base: one spoke straight up = safe-wheel Y, not clock hands */}
        {[-90, 30, 150].map((deg) => (
          <line
            key={deg}
            x1="40"
            y1="40"
            x2={40 + 21 * Math.cos((deg * Math.PI) / 180)}
            y2={40 + 21 * Math.sin((deg * Math.PI) / 180)}
            stroke={`url(#${gid})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
        <circle cx="40" cy="40" r="5.5" fill="var(--surface)" stroke={`url(#${gid})`} strokeWidth="2" />
      </g>
    </svg>
  );
}
