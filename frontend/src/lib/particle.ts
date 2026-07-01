import { SmartAccount } from '@particle-network/aa';

// Wraps a Magic provider in a Particle Universal Account so the user's
// funds on any chain are accessible under one unified balance.
export async function createUniversalAccount(magicProvider: unknown) {
  const smartAccount = new SmartAccount(magicProvider, {
    projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
    clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
    appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
    aaOptions: {
      accountContracts: {
        SIMPLE: [{ chainIds: [42161], version: '2.0.0' }],
      },
    },
  });

  const address = await smartAccount.getAddress();
  return { smartAccount, address };
}
