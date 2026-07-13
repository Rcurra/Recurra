// Landing palette — mirrors the black & white glass vars in globals.css so
// every landing section draws from one place and never hardcodes a color.
// Monochrome throughout — NO color anywhere (user ruling 2026-07-11);
// even the background glows are white light.
export const T = {
  bg: '#000000', /* pure black — the stars and planets are the light */
  cardGlass: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
  borderBright: 'rgba(255,255,255,0.16)',
  text: '#FFFFFF',
  dim: 'rgba(255,255,255,0.72)',
  faint: 'rgba(255,255,255,0.5)',
  // legacy accent slots — white now; kept so section code reads unchanged
  mint: '#FFFFFF',
  violet: '#FFFFFF',
  violetLight: 'rgba(255,255,255,0.75)',
  headline: '#FFFFFF',
  // background glows — monochrome white light for the glass to frost
  orbGlow: 'rgba(255,255,255,0.05)',
  orbGlowDim: 'rgba(255,255,255,0.03)',
} as const;
