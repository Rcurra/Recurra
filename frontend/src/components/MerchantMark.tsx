import { useId } from 'react';

// A deterministic mini-planet for a merchant address — same address, same
// planet, everywhere. Identity without metadata: the chain doesn't know
// merchant names, but it doesn't need to for you to recognize one.
// Hue, ring, and band all derive from the address bytes.
function traits(address: string) {
  let h = 0;
  for (let i = 2; i < address.length; i++) {
    h = (h * 31 + address.charCodeAt(i)) >>> 0;
  }
  return {
    hue: h % 360,
    ring: h % 3 === 0,
    band: h % 5 === 0,
    tilt: -30 + (h % 60),
  };
}

export function MerchantMark({ address, size = 28 }: { address: string; size?: number }) {
  const gid = useId();
  const t = traits(address);
  const color = `oklch(0.75 0.14 ${t.hue})`;

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ overflow: 'visible' }} aria-hidden>
      <defs>
        <radialGradient id={`${gid}-light`} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx="20" cy="20" r="13" />
        </clipPath>
      </defs>

      {/* body + sunlit side + crescent shadow — the landing planets' shading */}
      <circle cx="20" cy="20" r="13" fill={color} opacity="0.8" />
      <circle cx="20" cy="20" r="13" fill={`url(#${gid}-light)`} />
      {t.band && (
        <path
          d="M8 17 Q20 23 32 16.5"
          fill="none"
          stroke="#06070B"
          strokeWidth="2"
          opacity="0.35"
          clipPath={`url(#${gid}-clip)`}
        />
      )}
      <circle cx="26" cy="26" r="13.5" fill="#06070B" opacity="0.55" clipPath={`url(#${gid}-clip)`} />
      <circle cx="20" cy="20" r="13" fill="none" stroke={color} strokeWidth="1" opacity="0.7" />

      {t.ring && (
        <g transform={`rotate(${t.tilt} 20 20)`}>
          <ellipse cx="20" cy="20" rx="19" ry="6.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}
