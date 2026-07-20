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

  export enum SUPPORTED_TOKEN_TYPE {
    ETH = 'eth',
    USDT = 'usdt',
    USDC = 'usdc',
    BNB = 'bnb',
    SOL = 'sol',
  }

  export interface EIP7702Authorization {
    userOpHash: string;
    signature: string;
  }

  // Lifecycle of a sent universal transaction (dist/index.d.ts, verbatim).
  // FINISHED is the only success terminal; EXECUTION_FAILED and the whole
  // REFUND_*/PENNY_FAILED family mean the route didn't happen (funds either
  // never left or came back).
  export enum UA_TRANSACTION_STATUS {
    INITIALIZING = 0,
    DEPOSIT_LOCAL = 1,
    DEPOSIT_PENDING = 2,
    WAIT_TO_REFUND = 3,
    EXECUTION_LOCAL = 4,
    EXECUTION_PENDING = 5,
    EXECUTION_FAILED = 6,
    FINISHED = 7,
    REFUND_LOCAL = 8,
    REFUND_PENDING = 9,
    REFUND_FAILED = 10,
    REFUND_FINISHED = 11,
    PENNY_LOCAL = 12,
    PENNY_PENDING = 13,
    PENNY_FAILED = 14,
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
    /** Fee this op will deduct, hex-18-dec amounts (live probe 2026-07-20). */
    feeDeductions?: IUATokenDelta[];
    gasFeeInUSD?: string;
  }

  export interface ITransaction {
    transactionId: string;
    rootHash: string;
    userOps: IUserOpWithChain[];
    // Quote-side plan summary (live probe 2026-07-20): decr is the
    // PRINCIPAL split per source chain — the two probed entries summed to
    // exactly the requested amount; fees live in userOps[].feeDeductions
    // and transactionFees, not here. No incr, no totalFeeInUSD on quotes.
    tokenChanges: {
      from?: string;
      to?: string;
      fromChains?: number[];
      toChains?: number[];
      decr?: IUATokenDelta[];
    };
    transactionFees?: {
      freeGasFee: boolean;
      freeServiceFee: boolean;
      transactionServiceFeeAmountInUSD?: string;
      transactionLPFeeAmountInUSD?: string;
    };
  }

  export interface IAssetsResponse {
    assets: unknown[];
    totalAmountInUSD: number;
  }

  // getTransaction's response — untyped upstream (`Promise<any>`); shape
  // transcribed from a live probe against a real finished transfer
  // (2026-07-20, transactionId 0x0656fc9e59523d). Quirks that matter:
  //   - every `amount`/`amountInUSD`/fee figure is a HEX string normalized
  //     to 18 decimals regardless of the token's realDecimals;
  //   - the per-chain execution hashes live in the four *UserOperations
  //     arrays (a plain same-chain transfer showed up under
  //     lendingUserOperations, not depositUserOperations — treat the four
  //     as one pool, don't read meaning into the names);
  //   - `incr` can be entirely absent from tokenChanges even on success.
  export interface IUATokenSlice {
    chainId: number;
    address: string;
    symbol?: string;
    decimals: number;
    realDecimals: number;
  }

  export interface IUATokenDelta {
    token: IUATokenSlice;
    amount: string;
    amountInUSD: string;
  }

  export interface IUADetailUserOp {
    chainId: number;
    userOpHash: string;
    status: number;
    txHash: string;
    failedReason?: string;
  }

  export interface IUATransactionDetail {
    transactionId: string;
    sender: string;
    receiver: string;
    status: UA_TRANSACTION_STATUS;
    created_at: string;
    updated_at: string;
    fees: {
      totals: {
        feeTokenAmountInUSD: string;
        gasFeeTokenAmountInUSD: string;
        transactionServiceFeeTokenAmountInUSD: string;
        transactionLPFeeTokenAmountInUSD: string;
      };
      freeGasFee: boolean;
      freeServiceFee: boolean;
    };
    tokenChanges: {
      from?: string;
      to?: string;
      fromChains?: number[];
      toChains?: number[];
      decr?: IUATokenDelta[];
      incr?: IUATokenDelta[];
    };
    depositUserOperations: IUADetailUserOp[];
    lendingUserOperations: IUADetailUserOp[];
    settlementUserOperations: IUADetailUserOp[];
    refundUserOperations: IUADetailUserOp[];
  }

  export class UniversalAccount {
    constructor(config: IUniversalAccountConfig);
    getPrimaryAssets(): Promise<IAssetsResponse>;
    createTransferTransaction(payload: {
      token: { chainId: number; address: string };
      amount: string;
      receiver: string;
    }): Promise<ITransaction>;
    // Untyped upstream (`Promise<any>`); shape transcribed from
    // Particle-Network/ua-7702-magic-demo's usage: one entry per requested
    // chain, `nonce` being the EOA's CURRENT on-chain nonce there.
    getEIP7702Auth(chainIds: number[]): Promise<{ chainId?: number; address: string; nonce: number }[]>;
    createUniversalTransaction(payload: {
      chainId: number;
      expectTokens: { type: SUPPORTED_TOKEN_TYPE; amount: string }[];
      transactions: { to: string; data: string; value?: string }[];
    }): Promise<ITransaction>;
    sendTransaction(
      transaction: ITransaction,
      signature: string,
      authorizations?: EIP7702Authorization[],
    ): Promise<{ transactionId?: string }>;
    getTransaction(transactionId: string): Promise<IUATransactionDetail>;
  }
}
