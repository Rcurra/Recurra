// Global Buffer/process shims for @particle-network/universal-account-sdk's
// Solana dependency (@coral-xyz/anchor) — it references Node's ambient
// Buffer/process globals directly, not as module imports, so Turbopack's
// resolveAlias (next.config.ts) isn't enough on its own; something has to
// actually assign them onto window before that code runs. Imported once,
// first thing, from the root layout. Guarded for SSR, where window doesn't
// exist and none of this is needed anyway.
import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
  const w = window as unknown as { Buffer?: typeof Buffer; process?: typeof process };
  w.Buffer ??= Buffer;
  w.process ??= process;
}
