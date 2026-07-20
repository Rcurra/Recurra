// Particle Universal Accounts — the cross-chain fund step. The ONLY file
// that may import @particle-network/universal-account-sdk.
//
// F6, per CONCEPT.md's confirmed strategy: UA SDK in EIP-7702 mode
// (useEIP7702: true — track requirement, the 4337 escape hatch does NOT
// satisfy it), delegated on SOURCE chains only (Base/Polygon, wherever the
// user's other-chain funds actually sit). Arbitrum's 7702 slot belongs to
// ZeroDev Kernel and is never touched here — confirmed by Particle
// (2026-07-08, Discord): source-chain delegation alone is sufficient,
// funds are then spendable to any supported chain. The cross-chain op is
// this file's whole job: read the unified balance, then route the user's
// other-chain USDC to their own address on Arbitrum, where the existing
// Kernel deposit flow (lib/zerodev.ts) picks it up from there — Particle
// never touches the vault or the session key.
//
// Mainnet-only (no testnet anywhere in Particle's UA stack, confirmed by
// Particle 2026-07-08) — feature-flagged via PARTICLE_ENABLED, default
// deposit path must work with this entirely absent.
//
// The real API here is verified against Particle's own working demo
// (github.com/Particle-Network/universal-accounts-7702) and this
// package's shipped .d.ts, not just the docs site — the docs' own
// reference pages don't show a complete working example end to end.

// Must load before the SDK import below — @coral-xyz/anchor (Particle's
// Solana dependency) runs `new Program(...)` as a side effect of merely
// being imported, referencing Node's ambient Buffer/process globals.
// Scoped here, not the root layout: this shim should only ever run for
// the one feature that needs it, not on every page load.
import './polyfills';

import { encodeFunctionData, erc20Abi, serializeSignature } from 'viem';
import {
  CHAIN_ID,
  SUPPORTED_TOKEN_TYPE,
  UA_TRANSACTION_STATUS,
  UNIVERSAL_ACCOUNT_VERSION,
  UniversalAccount,
  type EIP7702Authorization,
  type ITransaction,
  type IUATokenDelta,
  type IUATransactionDetail,
} from '@particle-network/universal-account-sdk';
import { getSigner, send7702SelfDelegation } from './magic';
import type { RouteReceiptStatus, RouteTokenDelta } from './routeReceipts';

export const PARTICLE_ENABLED = process.env.NEXT_PUBLIC_PARTICLE_ENABLED === '1';

// Circle's canonical native USDC on Arbitrum One
// (arbiscan.io/token/0xaf88d065e77c8cC2239327C5EDb3A432268e5831) —
// deliberately NOT lib/contracts.ts's MockUSDC address; Particle's whole
// stack is mainnet-only, so this constant is too.
const ARBITRUM_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

function getParticleConfig(): { projectId: string; projectClientKey: string; projectAppUuid: string } {
  const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
  const projectClientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY;
  const projectAppUuid = process.env.NEXT_PUBLIC_PARTICLE_APP_ID;
  if (!projectId || !projectClientKey || !projectAppUuid) {
    throw new Error(
      'Particle is enabled but NEXT_PUBLIC_PARTICLE_PROJECT_ID/CLIENT_KEY/APP_ID are not set — get real values from the Particle dashboard',
    );
  }
  return { projectId, projectClientKey, projectAppUuid };
}

function buildUniversalAccount(ownerAddress: string): UniversalAccount {
  const { projectId, projectClientKey, projectAppUuid } = getParticleConfig();
  return new UniversalAccount({
    projectId,
    projectClientKey,
    projectAppUuid,
    smartAccountOptions: {
      name: 'UNIVERSAL',
      version: UNIVERSAL_ACCOUNT_VERSION,
      ownerAddress,
      useEIP7702: true,
    },
  });
}

// Signs a UA transaction's rootHash with the account's own owner key — a
// plain personal-message signature over raw bytes (EIP-191, same scheme
// personal_sign uses), entirely outside Particle's SDK; it only builds and
// submits transactions, never touches key material. Branches on
// RecurraSigner the same shape lib/zerodev.ts's eip7702Account param does,
// but has to do it explicitly here since Particle's API wants a raw
// signature string back, not a viem account object to hand off to another
// SDK.
async function signRootHash(ownerAddress: string, rootHash: `0x${string}`): Promise<`0x${string}`> {
  const signer = getSigner();
  if (!signer) throw new Error('Not logged in — no signer available');
  if ('signMessage' in signer) {
    // LocalAccount (dev-wallet mode).
    return signer.signMessage({ message: { raw: rootHash } });
  }
  // EIP1193Provider (real-Magic mode) — rootHash is already 0x-hex, the
  // standard personal_sign shape (raw bytes, not UTF8 text to re-encode).
  const signature = await signer.request({
    method: 'personal_sign',
    params: [rootHash, ownerAddress as `0x${string}`],
  });
  return signature as `0x${string}`;
}

export async function getUnifiedBalance(ownerAddress: string): Promise<{ totalUsd: number }> {
  const ua = buildUniversalAccount(ownerAddress);
  const assets = await ua.getPrimaryAssets();
  return { totalUsd: assets.totalAmountInUSD };
}

// What routeToArbitrum hands back for the receipt trail: the transactionId
// (Particle's tracker key), which chains the accepted quote planned to
// touch, and any one-time delegation installs performed along the way —
// everything known synchronously at send time. Execution facts (per-chain
// tx hashes, real fees, final status) don't exist yet; hydrateRouteReceipt
// fetches those afterwards.
export type RouteResult = {
  transactionId: string;
  plannedChains: number[];
  delegations: { chainId: number; txHash: string }[];
};

// The route is deliberately TWO exported steps — quoteRouteToArbitrum then
// executeRoute — not one: the user's only approval is a personal_sign over
// an opaque rootHash (they cannot read what it commits to), so the UI must
// show them the quote's plan — what gets spent where, what it costs — and
// get an explicit confirm BEFORE anything signs. Audit finding P-1/P-2
// (2026-07-20); collapsing these back into one call reopens it.

// `amount` is USDC's 6-decimal bigint, same convention as everywhere else
// in the app; converted to the plain decimal string Particle's API wants
// only at this call boundary. `destination` defaults to the owner (the
// fund-the-vault flow); any other address turns the same route into a
// withdrawal/payment — identical solver/delegation/fee mechanics, only the
// final transfer(receiver, amount) calldata changes.
function makeQuote(ua: UniversalAccount, destination: `0x${string}`, amount: bigint) {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, '0');
  const amountDecimal = `${whole}.${fraction}`;

  // Quoted via createUniversalTransaction, NOT createTransferTransaction:
  // the transfer quote endpoint rejects every cross-chain request with
  // -32653 "Insufficient primary token balance" regardless of balance
  // (found live 2026-07-18 at $0.55, reconfirmed 2026-07-19 at $1.55;
  // same-chain quotes pass, raw-RPC repro posted to the UXmaxx Discord
  // thread). The universal quote is a different backend path — and it's
  // what Particle's own 7702 demo (universal-accounts-7702's
  // TransferCard) uses for exactly this shape of USDC withdrawal:
  // expectTokens asks the router to make the USDC spendable on the
  // destination chain, and the transaction is a plain ERC-20
  // transfer(owner, amount) on Arbitrum's canonical USDC. Same outcome,
  // same 7702 delegation, different quote route. expectTokens takes the
  // decimal string; the calldata takes raw 6-decimal units — both
  // derived from the same `amount` above.
  //
  // The quote call is still where balance/fee rejections land.
  // UniversalError carries a numeric .code and a .data payload the
  // one-line message hides; log the whole object before rethrowing so a
  // quote rejection is debuggable.
  // A closure, not a one-shot: the Magic path below pre-delegates on-chain
  // and must REQUOTE afterwards — the original quote's userOps were built
  // for an undelegated account and go stale the moment delegation lands.
  const quote = async () => {
    try {
      return await ua.createUniversalTransaction({
        chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE,
        expectTokens: [{ type: SUPPORTED_TOKEN_TYPE.USDC, amount: amountDecimal }],
        transactions: [
          {
            to: ARBITRUM_USDC,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [destination, amount],
            }),
          },
        ],
      });
    } catch (e) {
      console.error('routeToArbitrum: createUniversalTransaction (quote) rejected', e);
      throw e;
    }
  };
  return { amountDecimal, quote };
}

const opsNeedingAuth = (tx: ITransaction) =>
  tx.userOps.filter((op) => op.eip7702Auth && !op.eip7702Delegated);

// Both quote and detail responses carry token movements in the same
// {token, amount, amountInUSD} hex-18-dec shape — one normalizer for both.
function toDelta(d: IUATokenDelta): RouteTokenDelta {
  return {
    symbol: d.token.symbol ?? 'token',
    chainId: d.token.chainId,
    amount: hexAmountToNumber(d.amount),
    usd: hexAmountToNumber(d.amountInUSD),
  };
}

// gasFeeInUSD's wire format is unconfirmed (absent from the live probe) —
// accept hex-18-dec or plain decimal, contribute 0 when absent/garbled.
function usdField(value: string | undefined): number {
  if (!value) return 0;
  return value.startsWith('0x') ? hexAmountToNumber(value) : Number(value) || 0;
}

export type RouteQuoteSummary = {
  /** "1.200000" — the exact decimal handed to Particle. */
  amountDecimal: string;
  /** Withdrawal target, or null when routing to the owner's own address. */
  receiver: string | null;
  /** Principal split per source chain (quote's tokenChanges.decr). */
  sent: RouteTokenDelta[];
  /** Estimated total fees in USD (per-op deductions + service + LP). */
  feeUsd: number;
  fromChains: number[];
  /** Chains needing their one-time delegation before this route can run. */
  needsSetup: number[];
};

export type PreparedRoute = {
  summary: RouteQuoteSummary;
  ownerAddress: string;
  amount: bigint;
  receiver?: string;
  /** The quoted plan executeRoute starts from (requoted if setup runs). */
  transaction: ITransaction;
};

// Step 1: quote only — read-only, signs nothing, safe to discard. Returns
// everything the confirm card needs plus the plan executeRoute picks up.
export async function quoteRouteToArbitrum(
  ownerAddress: string,
  amount: bigint,
  receiver?: string,
): Promise<PreparedRoute> {
  const destination = (receiver ?? ownerAddress) as `0x${string}`;
  const ua = buildUniversalAccount(ownerAddress);
  const { amountDecimal, quote } = makeQuote(ua, destination, amount);
  const transaction = await quote();

  const feeUsd =
    transaction.userOps.reduce(
      (sum, op) =>
        sum +
        usdField(op.gasFeeInUSD) +
        (op.feeDeductions ?? []).reduce((s, f) => s + hexAmountToNumber(f.amountInUSD), 0),
      0,
    ) +
    hexAmountToNumber(transaction.transactionFees?.transactionServiceFeeAmountInUSD) +
    hexAmountToNumber(transaction.transactionFees?.transactionLPFeeAmountInUSD);

  return {
    summary: {
      amountDecimal,
      receiver: receiver ?? null,
      sent: (transaction.tokenChanges?.decr ?? []).map(toDelta),
      feeUsd,
      fromChains:
        transaction.tokenChanges?.fromChains ?? [...new Set(transaction.userOps.map((op) => op.chainId))],
      needsSetup: [...new Set(opsNeedingAuth(transaction).map((op) => op.chainId))],
    },
    ownerAddress,
    amount,
    receiver,
    transaction,
  };
}

// Step 2: execute a confirmed quote — delegation dance if needed, sign the
// rootHash, send. The only function in this file that triggers signatures.
export async function executeRoute(prepared: PreparedRoute): Promise<RouteResult> {
  const { ownerAddress, amount, receiver } = prepared;
  const destination = (receiver ?? ownerAddress) as `0x${string}`;
  const ua = buildUniversalAccount(ownerAddress);
  const { quote } = makeQuote(ua, destination, amount);
  let transaction = prepared.transaction;

  // Every userOp on a chain this owner hasn't delegated on yet demands an
  // EIP-7702 authorization — and Particle asks for the CHAIN-AGNOSTIC one
  // (auth.chainId 0, valid everywhere). How each signer meets that demand
  // was settled the expensive way, live on mainnet 2026-07-19:
  //   - LocalAccount (dev-wallet): viem's signAuthorization signs the
  //     chainId-0 authorization exactly as requested, inline. Done.
  //   - Real Magic: cannot sign chainId-0 auths at all (-32603), and
  //     per-chain signatures handed back inline fail bundler validation
  //     with AA24 — Particle reconstructs the chainId-0 tuple it asked
  //     for, which our per-chain signature doesn't verify against. The
  //     working pattern (ua-7702-magic-demo's ensureDelegated, and the
  //     docs' "pre-delegation flow"): install the delegation FIRST with a
  //     real Type-4 self-transaction per chain (lib/magic.ts's
  //     send7702SelfDelegation), then requote until Particle reports the
  //     ops eip7702Delegated — after which no authorization is needed.
  const signer = getSigner();
  if (!signer) throw new Error('Not logged in — no signer available');

  const authorizations: EIP7702Authorization[] = [];
  const delegations: { chainId: number; txHash: string }[] = [];
  const pending = opsNeedingAuth(transaction);
  if (pending.length > 0) {
    if ('signAuthorization' in signer && signer.signAuthorization) {
      const signedByChainNonce = new Map<string, string>();
      for (const op of pending) {
        const auth = op.eip7702Auth!;
        const cacheKey = `${auth.chainId}:${auth.nonce}`;
        let signature = signedByChainNonce.get(cacheKey);
        if (!signature) {
          const local = await signer.signAuthorization({
            address: auth.address as `0x${string}`,
            chainId: auth.chainId,
            nonce: auth.nonce,
          });
          // yParity is always populated in practice (viem's own local signer
          // sets it directly), but the type only guarantees v-or-yParity —
          // never trust that ambiguity blindly, it's the exact bug that cost
          // hours on the Kernel path (see sign7702Authorization's history).
          const yParity = local.yParity ?? (local.v === 27n || local.v === 0n ? 0 : 1);
          signature = serializeSignature({ r: local.r, s: local.s, yParity });
          signedByChainNonce.set(cacheKey, signature);
          console.info('routeToArbitrum: signed EIP-7702 authorization', {
            chainId: auth.chainId,
            address: auth.address,
            nonce: auth.nonce,
          });
        }
        authorizations.push({ userOpHash: op.userOpHash, signature });
      }
    } else {
      // One Type-4 tx per undelegated chain. Gas comes from the EOA's own
      // native ETH on each chain — the single real-money prerequisite;
      // "insufficient funds" here means send that chain a little ETH.
      const chainIds = [...new Set(pending.map((op) => op.chainId))];
      const auths = await ua.getEIP7702Auth(chainIds);
      for (let i = 0; i < chainIds.length; i++) {
        // Match the auth entry to its chain by chainId when the entry
        // names one; position only as the fallback (audit P-5 — the
        // response's order isn't contractual, and a mismatched pairing
        // would sign the wrong nonce for the wrong chain). Entries often
        // report chainId 0 (chain-agnostic), which is also why the
        // switchChain target below uses `||`, not `??`: zero must fall
        // back to the concrete chain, or Magic gets switchChain(0)
        // (-32602, found live).
        const auth = auths.find((a) => a.chainId === chainIds[i]) ?? auths[i];
        if (!auth) {
          throw new Error(`getEIP7702Auth returned no entry for chain ${chainIds[i]}`);
        }
        const chainId = auth.chainId || chainIds[i];
        const { transactionHash } = await send7702SelfDelegation({
          ownerAddress: ownerAddress as `0x${string}`,
          chainId,
          contractAddress: auth.address as `0x${string}`,
          // +1: the self-tx consumes the current nonce first (see
          // send7702SelfDelegation).
          nonce: auth.nonce + 1,
        });
        console.info('routeToArbitrum: pre-delegated', { chainId, transactionHash });
        delegations.push({ chainId, txHash: transactionHash });
      }
      // The delegations mine in seconds on both chains, but Particle's
      // indexer has its own clock — poll the requote until every op comes
      // back delegated instead of trusting one blind attempt.
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        transaction = await quote();
        if (opsNeedingAuth(transaction).length === 0) break;
      }
      const still = opsNeedingAuth(transaction);
      if (still.length > 0) {
        throw new Error(
          `Delegation sent but not yet visible on chain(s) ${still.map((o) => o.chainId).join(', ')} — wait a few seconds and press Route again`,
        );
      }
    }
  }

  const rootHashSignature = await signRootHash(ownerAddress, transaction.rootHash as `0x${string}`);
  try {
    const result = await ua.sendTransaction(transaction, rootHashSignature, authorizations);
    return {
      transactionId: result?.transactionId ?? '',
      plannedChains: [...new Set(transaction.userOps.map((op) => op.chainId))],
      delegations,
    };
  } catch (e) {
    // Same discipline as lib/zerodev.ts's subscribeAndFund: a rejection
    // here is too generic to fix blind. Particle's UniversalError carries
    // a numeric .code and optional .data the bare .message can hide — log
    // the whole thing before rethrowing unchanged so walletErrorMessage
    // still handles the user-facing side.
    console.error('routeToArbitrum: sendTransaction rejected', e);
    throw e;
  }
}

// Every USD/token figure in getTransaction's response is a hex string
// normalized to 18 decimals (live probe 2026-07-20), whatever the token's
// realDecimals say. Number precision is plenty — these are display values
// under a few dollars, never money math.
function hexAmountToNumber(hex: string | undefined): number {
  if (!hex) return 0;
  try {
    return Number(BigInt(hex)) / 1e18;
  } catch {
    return 0;
  }
}

function toStatus(status: UA_TRANSACTION_STATUS): RouteReceiptStatus {
  if (status === UA_TRANSACTION_STATUS.FINISHED) return 'success';
  // Everything on the refund path counts as failed from the user's seat:
  // the USDC did not land on Arbitrum, whatever happened to the change.
  const failed = [
    UA_TRANSACTION_STATUS.WAIT_TO_REFUND,
    UA_TRANSACTION_STATUS.EXECUTION_FAILED,
    UA_TRANSACTION_STATUS.REFUND_LOCAL,
    UA_TRANSACTION_STATUS.REFUND_PENDING,
    UA_TRANSACTION_STATUS.REFUND_FAILED,
    UA_TRANSACTION_STATUS.REFUND_FINISHED,
    UA_TRANSACTION_STATUS.PENNY_FAILED,
  ];
  return failed.includes(status) ? 'failed' : 'pending';
}

export type RouteHydration = {
  status: RouteReceiptStatus;
  feeUsd: number | null;
  feeGasUsd: number | null;
  feeServiceUsd: number | null;
  fromChains: number[];
  toChains: number[];
  sent: RouteTokenDelta[];
  received: RouteTokenDelta[];
  chainTxs: { chainId: number; txHash: string }[];
};

// Fetches what actually happened to a sent route from Particle's indexer —
// final status, real fee, tokens consumed, and the per-chain execution tx
// hashes the receipt links to. Callable any time after sendTransaction
// (including for receipts restored from storage sessions later); status
// stays 'pending' until Particle finishes, so callers just re-poll.
export async function hydrateRouteReceipt(
  ownerAddress: string,
  transactionId: string,
): Promise<RouteHydration> {
  const ua = buildUniversalAccount(ownerAddress);
  const detail: IUATransactionDetail = await ua.getTransaction(transactionId);

  // The four arrays split Particle's internal phases (a plain same-chain
  // transfer showed up under lendingUserOperations) — the receipt only
  // cares that each hash is a real transaction on some chain, so pool them.
  const chainTxs = [
    ...detail.depositUserOperations,
    ...detail.lendingUserOperations,
    ...detail.settlementUserOperations,
    ...detail.refundUserOperations,
  ]
    .filter((op) => op.txHash)
    .filter((op, i, all) => all.findIndex((o) => o.txHash === op.txHash) === i)
    .map((op) => ({ chainId: op.chainId, txHash: op.txHash }));

  const totals = detail.fees?.totals;
  // "Service" from the user's seat = everything that isn't gas — Particle's
  // service fee plus its LP cut.
  const serviceUsd =
    hexAmountToNumber(totals?.transactionServiceFeeTokenAmountInUSD) +
    hexAmountToNumber(totals?.transactionLPFeeTokenAmountInUSD);

  return {
    status: toStatus(detail.status),
    feeUsd: hexAmountToNumber(totals?.feeTokenAmountInUSD),
    feeGasUsd: hexAmountToNumber(totals?.gasFeeTokenAmountInUSD),
    feeServiceUsd: serviceUsd,
    fromChains: detail.tokenChanges.fromChains ?? [],
    toChains: detail.tokenChanges.toChains ?? [],
    sent: (detail.tokenChanges.decr ?? []).map(toDelta),
    received: (detail.tokenChanges.incr ?? []).map(toDelta),
    chainTxs,
  };
}
