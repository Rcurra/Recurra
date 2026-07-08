import { defineChain, type Chain } from 'viem';
import { arbitrumSepolia, foundry } from 'viem/chains';

// Maps NEXT_PUBLIC_CHAIN_ID to a viem Chain. Known ids get viem's own
// definitions; anything else (a future testnet, a different local setup)
// falls back to a minimal chain built from NEXT_PUBLIC_RPC_URL so this
// never silently breaks when the env moves on without this file catching up.
export function getChain(): Chain {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? foundry.id);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? foundry.rpcUrls.default.http[0];

  if (id === foundry.id) return foundry;
  if (id === arbitrumSepolia.id) return arbitrumSepolia;

  return defineChain({
    id,
    name: `chain-${id}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}
