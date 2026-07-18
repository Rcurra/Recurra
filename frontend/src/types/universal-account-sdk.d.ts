// @particle-network/universal-account-sdk@2.0.3 ships a complete .d.ts
// (dist/index.d.ts) but its package.json "exports" map has no "types"
// condition, so bundler-mode TypeScript can't resolve it and the import
// degrades to implicit-any. Two failed fixes before this one, both
// worth recording:
//   1. tsconfig "paths" remap to the .d.ts — a trap: Next.js/Turbopack
//      honors tsconfig paths as RUNTIME aliases too, so the browser
//      bundle imported the .d.ts (zero runtime exports) and every SDK
//      symbol became undefined — "new UniversalAccount(...)" threw
//      "(void 0) is not a constructor" live while plain Node (which
//      ignores tsconfig) passed. Found live 2026-07-18.
//   2. declare module + `export * from '<relative path to dist>'` —
//      TypeScript forbids relative module references inside ambient
//      declarations, and skipLibCheck silently swallowed the error,
//      leaving the module empty ("has no exported member").
// So: a minimal hand-written declaration of exactly the surface
// lib/particle.ts consumes, transcribed from the real dist/index.d.ts.
// Ambient declarations are only ever read by TypeScript, never the
// bundler — runtime resolution stays on the package's real exports map.
// Drop this file when upstream adds a "types" condition.
declare module '@particle-network/universal-account-sdk' {
  export enum CHAIN_ID {
    SOLANA_MAINNET = 101,
    ETHEREUM_MAINNET = 1,
    BSC_MAINNET = 56,
    BASE_MAINNET = 8453,
    XLAYER_MAINNET = 196,
    ARBITRUM_MAINNET_ONE = 42161,
  }

  export const UNIVERSAL_ACCOUNT_VERSION: string;

  export interface EIP7702Authorization {
    userOpHash: string;
    signature: string;
  }

  export interface ISmartAccountOptions {
    name: string;
    version: string;
    ownerAddress: string;
    smartAccountAddress?: string;
    useEIP7702?: boolean;
  }

  export interface IUniversalAccountConfig {
    projectId: string;
    projectClientKey: string;
    projectAppUuid: string;
    smartAccountOptions?: ISmartAccountOptions;
    rpcUrl?: string;
  }

  export interface IUserOpWithChain {
    chainId: number;
    userOpHash: string;
    eip7702Auth?: { chainId: number; nonce: number; address: string };
    eip7702Delegated?: boolean;
  }

  export interface ITransaction {
    transactionId: string;
    rootHash: string;
    userOps: IUserOpWithChain[];
  }

  export interface IAssetsResponse {
    assets: unknown[];
    totalAmountInUSD: number;
  }

  export class UniversalAccount {
    constructor(config: IUniversalAccountConfig);
    getPrimaryAssets(): Promise<IAssetsResponse>;
    createTransferTransaction(payload: {
      token: { chainId: number; address: string };
      amount: string;
      receiver: string;
    }): Promise<ITransaction>;
    sendTransaction(
      transaction: ITransaction,
      signature: string,
      authorizations?: EIP7702Authorization[],
    ): Promise<{ transactionId?: string }>;
  }
}
