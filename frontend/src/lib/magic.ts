// Magic — email-OTP login → EOA. The ONLY file that may import magic-sdk.
//
// F1 implements: email OTP flow (magic-sdk + @magic-ext/evm for EIP-7702
// signing support), EIP-1193 provider → viem WalletClient, session restore,
// logout. Nothing Magic-specific leaks past this file.
//
// Dev bypass: NEXT_PUBLIC_DEV_WALLET=1 swaps this for a local anvil key so
// the app runs offline with no Magic quota (see frontend/plan.md F1).

export async function loginWithEmail(_email: string): Promise<string> {
  throw new Error('lib/magic: implemented at F1');
}

export async function restoreSession(): Promise<string | null> {
  throw new Error('lib/magic: implemented at F1');
}

export async function logout(): Promise<void> {
  throw new Error('lib/magic: implemented at F1');
}
