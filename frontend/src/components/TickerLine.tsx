// The ticker, off duty — the same message-between-hairlines stream the
// error component wears, without the alarm: quiet tracked text on a
// slow seamless loop. For credit lines and standing promises that
// deserve motion but not urgency. Pace scales with message length;
// hover pauses; reduced motion stands still.
export function TickerLine({ message }: { message: string }) {
  const dur = Math.max(14, Math.round(message.length * 0.45));
  return (
    <div className="relative overflow-hidden border-y border-ink/15 py-2">
      <style>{`
        @keyframes lineTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .line-ticker { animation: none !important; } }
      `}</style>
      <div
        className="line-ticker flex w-max whitespace-nowrap hover:[animation-play-state:paused]"
        style={{ animation: `lineTicker ${dur}s linear infinite` }}
      >
        {/* four copies; the loop shifts exactly two (-50%), so the seam
            never shows regardless of message length */}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden={i > 0}
            className="text-[10.5px] uppercase tracking-[0.22em] text-ink/80"
          >
            {message}
            <span className="px-5 text-ink-faint">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
