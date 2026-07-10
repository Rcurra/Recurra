// Calm, not busy: one breathing dot + a label, the same register as the
// route guard's "Loading your account…" — no spinners, no skeleton
// shimmer, just an honest "this is still fetching."
export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-10">
      <span
        className="breathe h-1.5 w-1.5 shrink-0 rounded-full bg-mint"
        style={{ boxShadow: '0 0 6px var(--mint)' }}
      />
      <p className="numeric text-[11px] uppercase tracking-[0.2em] text-ink-faint">{label}</p>
    </div>
  );
}
