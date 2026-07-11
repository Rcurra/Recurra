// A failed write deserves a contained box, not bare colored text floating
// under a button — same reasoning as LoadingLine giving "still fetching" a
// visible home instead of silence. Sized for the compact action-modal
// captions (Plan/Sub/Vault); page-level fetch errors stay as-is.
export function InlineError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] leading-relaxed text-danger">
      {message}
    </p>
  );
}
