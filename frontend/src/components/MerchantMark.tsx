import { useId } from 'react';

// A deterministic mini-planet for a merchant address — same address, same
// planet, everywhere. Identity without metadata: the chain doesn't know
// merchant names, but it doesn't need to for you to recognize one.
// Monochrome like everything else — identity comes from geometry, not
// hue: brightness, ring, ring tilt, band, and crescent depth all derive
// from the address bytes.
function traits(address: string) {
  let h = 0;
  for (let i = 2; i < address.length; i++) {
    h = (h * 31 + address.charCodeAt(i)) >>> 0;
  }
  return {
    // brightness band: 0.34–0.62 white — distinct planets, none shouting
    shade: 0.34 + (h % 8) * 0.04,
    ring: h % 3 === 0,
    band: h % 5 === 0,
    tilt: -30 + (h % 60),
    crescent: h % 2 === 0,
  };
}

export function MerchantMark({ address, size = 28 }: { address: string; size?: number }) {
  const gid = useId();
  const t = traits(address);
  const color = `rgba(255,255,255,${t.shade})`;

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ overflow: 'visible' }} aria-hidden>
      <defs>
        <radialGradient id={`${gid}-light`} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx="20" cy="20" r="13" />
        </clipPath>
      </defs>

      {/* body + sunlit side + crescent shadow — the sky planets' shading */}
      <circle cx="20" cy="20" r="13" fill={color} opacity="0.8" />
      <circle cx="20" cy="20" r="13" fill={`url(#${gid}-light)`} />
      {t.band && (
        <path
          d="M8 17 Q20 23 32 16.5"
          fill="none"
          stroke="#000000"
          strokeWidth="2"
          opacity="0.4"
          clipPath={`url(#${gid}-clip)`}
        />
      )}
      <circle
        cx="26"
        cy="26"
        r="13.5"
        fill="#000000"
        opacity={t.crescent ? 0.75 : 0.5}
        clipPath={`url(#${gid}-clip)`}
      />
      <circle cx="20" cy="20" r="13" fill="none" stroke={color} strokeWidth="1" opacity="0.7" />

      {t.ring && (
        <g transform={`rotate(${t.tilt} 20 20)`}>
          <ellipse cx="20" cy="20" rx="19" ry="6.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.55" />
        </g>
      )}
    </svg>
  );
}
