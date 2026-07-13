import type { CSSProperties, ElementType, ReactNode } from 'react';

// THE panel of the app — every card, nav, sidebar, and modal is one of
// these. The recipe lives in globals.css (--glass-*) and only there;
// nothing else in the codebase declares its own frosted background.
//
// The surface is not flat: light falls across it diagonally from the
// top-left (the same corner every planet in this universe is lit from —
// one sun for everything), a soft pool of light sits at the top edge,
// and faint stardust lives inside the pane, so the glass reads as a
// window cut out of space rather than a gray rectangle laid over it.
// All three layers sit between the panel's background and its content
// (negative z inside an isolated stacking context), at opacities low
// enough to never fight text.
//
// as: rendered element (section for content cards, nav for bars, div for
//     fragments inside other panels).
// hairline: a white gradient line on the top edge — reserved for
//     section-level panels, never list rows.

// deterministic pseudo-random — integer bit-mixing, same recipe as the
// skies (deterministic across server and client, so no hydration drift)
function rand(i: number, salt: number): number {
  let t = (i * 374761393 + salt * 668265263) >>> 0;
  t = (t ^ (t >>> 13)) >>> 0;
  t = (t * 1274126177) >>> 0;
  t = (t ^ (t >>> 16)) >>> 0;
  return t / 4294967296;
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// stardust inside the pane — positions in %, so density thins out
// gracefully on small tiles and fills on heroes
const DUST = Array.from({ length: 16 }, (_, i) => ({
  left: r3(rand(i, 1) * 96 + 2),
  top: r3(rand(i, 2) * 92 + 4),
  size: rand(i, 3) < 0.2 ? 2 : 1.2,
  o: r3(0.05 + rand(i, 4) * 0.11),
}));

export function GlassPanel({
  as: Tag = 'section' as ElementType,
  hairline = false,
  className = '',
  style,
  children,
}: {
  as?: ElementType;
  hairline?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`relative isolate overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        ...style,
      }}
    >
      {/* the pane itself — light and dust, beneath the content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* light falling across the glass, from the universe's one sun */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.012) 55%, rgba(255,255,255,0) 80%)',
          }}
        />
        {/* the pool of light along the top edge */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 45% at 50% -12%, rgba(255,255,255,0.07), transparent 60%)',
          }}
        />
        {/* stardust in the glass */}
        {DUST.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-ink"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              opacity: d.o,
            }}
          />
        ))}
      </div>

      {hairline && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
          }}
        />
      )}
      {children}
    </Tag>
  );
}
