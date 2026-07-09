import type { CSSProperties, ReactNode } from 'react';

// The card language of the whole app — glass over the starfield, with the
// mint→violet hairline reserved for section-level cards (one per card,
// never on list rows; same restraint as the login card).
export function GlassCard({
  hairline = false,
  className = '',
  style,
  children,
}: {
  hairline?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface/75 backdrop-blur-xl ${className}`}
      style={style}
    >
      {hairline && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--mint), var(--violet), transparent)' }}
        />
      )}
      {children}
    </section>
  );
}
