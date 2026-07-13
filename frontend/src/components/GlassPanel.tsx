import type { CSSProperties, ElementType, ReactNode } from 'react';

// THE panel of the app — every card, nav, sidebar, and modal is one of
// these. The recipe lives in globals.css (--glass-*) and only there;
// nothing else in the codebase declares its own frosted background.
//
// as: rendered element (section for content cards, nav for bars, div for
//     fragments inside other panels).
// hairline: a white gradient line on the top edge — reserved for
//     section-level panels, never list rows.
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
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        ...style,
      }}
    >
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
