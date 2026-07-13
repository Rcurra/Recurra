import type { CSSProperties, ReactNode } from 'react';
import { GlassPanel } from './GlassPanel';

// Legacy name for the app's card — now a thin alias over GlassPanel so
// every existing card shares the single glass recipe. New code should
// import GlassPanel directly; this stays until the app screens migrate.
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
    <GlassPanel hairline={hairline} className={className} style={style}>
      {children}
    </GlassPanel>
  );
}
