// A failed action deserves a visible home — and here it's a ticker: the
// message streams between two parallel hairlines (the Relay-site move),
// impossible to miss without shouting. Monochrome like everything else;
// the alarm comes from structure, not hue: hairlines brighter than any
// card border, full-white text in a page of grays, and a tracked ERROR
// stamp riding the stream. Pauses under the cursor; stands still for
// users who ask for reduced motion.
export function InlineError({ message }: { message: string }) {
  // longer messages get a proportionally longer lap so the pace stays even
  const dur = Math.max(9, Math.round(message.length * 0.25));
  return (
    <div role="alert" className="relative overflow-hidden border-y border-ink/30 py-2">
      <style>{`
        @keyframes errTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .err-ticker { animation: none !important; } }
      `}</style>
      <div
        className="err-ticker flex w-max items-baseline whitespace-nowrap hover:[animation-play-state:paused]"
        style={{ animation: `errTicker ${dur}s linear infinite` }}
      >
        {/* four copies; the loop shifts exactly two of them (-50%), so the
            seam never shows regardless of message length */}
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden={i > 0} className="flex items-baseline">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-faint">
              Error
            </span>
            <span className="pl-3 text-[11px] leading-relaxed tracking-[0.06em] text-ink">
              {message}
            </span>
            <span className="px-4 text-ink-faint">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
