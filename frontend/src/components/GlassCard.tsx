import type { CSSProperties, ReactNode } from 'react';
import { GlassPanel } from './GlassPanel';

// Legacy name for the app's card — now a thin alias over GlassPanel so
// every existing card shares the single glass recipe. New code should
// import GlassPanel directly; this stays until the app screens migrate.
export function GlassCard({
  hairline = false,
  className = '',
  style,
  title,
  children,
}: {
  hairline?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  return (
    <GlassPanel hairline={hairline} className={className} style={style} title={title}>
      {children}
    </GlassPanel>
  );
}
