import { Magic } from 'magic-sdk';

let magic: Magic | null = null;

export function getMagic(): Magic {
  if (!magic && typeof window !== 'undefined') {
    magic = new Magic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY!, {
      network: {
        rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC!,
        chainId: 42161,
      },
    });
  }
  return magic!;
}

export async function loginWithEmail(email: string): Promise<string> {
  const m = getMagic();
  await m.auth.loginWithMagicLink({ email });
  const accounts = await m.wallet.connectWithUI();
  return accounts[0];
}

export async function logout() {
  await getMagic().user.logout();
}
