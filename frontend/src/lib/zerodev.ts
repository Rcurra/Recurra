// ZeroDev — the smart-account layer. The ONLY file that may import
// @zerodev/sdk / @zerodev/permissions / @zerodev/ecdsa-validator.
//
// F4, scope decided 2026-07-14 (plan.md): subscribe+fund only. Cancel,
// withdraw, and wallet Send stay on the plain-EOA path in lib/wallet.ts —
// untouched by this file. One signature here covers three things: the
// EIP-7702 delegation to Kernel (same address as the Magic EOA, first time
// only — the "same address, new powers" trick), installing a session key
// scoped to registry+USDC-approve+vault-deposit with a spend cap and an
// expiry, and the batched UserOperation itself (subscribe + approve +
// deposit), gas paid by ZeroDev's paymaster so the email-born account never
// needs ETH.
//
// Payment safety never depends on any of this — the Executor re-derives
// every charge's legitimacy from on-chain state regardless of how funds got
// into the vault (CONCEPT.md's session-key decision). The session key here
// is onboarding UX, not a trust boundary; recurring charges are triggered
// by the backend's scheduler against the Executor, never by this key.
//
// Requires NEXT_PUBLIC_CHAIN_ID pointed at a real chain (421614, Arbitrum
// Sepolia) — ZeroDev's bundler/paymaster are hosted services that don't
// know anvil. See .env.local.example for NEXT_PUBLIC_ZERODEV_RPC — host is
// rpc.zerodev.app (NOT passkeys.zerodev.app, ZeroDev's separate WebAuthn
// service — a real trap, found live 2026-07-14), one URL serving both
// bundler and paymaster JSON-RPC methods.

import { encodeFunctionData, getAddress, http, isAddress, parseEventLogs, zeroAddress } from 'viem';
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient, constants as zerodevConstants } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toPermissionValidator } from '@zerodev/permissions';
import { toCallPolicy, toTimestampPolicy, CallPolicyVersion, ParamCondition } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getChain } from './chain';
import { getRegistryAddress, getUsdcAddress, getVaultAddress, registryAbi, usdcAbi, vaultAbi } from './contracts';
import { getSigner, sign7702Authorization } from './magic';
import { buildTxReceipt, decodeRevertData, getPublicClient, getVaultBalance, type TxReceipt } from './wallet';

const isDevWallet = process.env.NEXT_PUBLIC_DEV_WALLET === '1';
// 0.3.3, not 0.3.1 — ZeroDev's SDK rejects EIP-7702 mode below kernel 0.3.3
// at runtime (found live 2026-07-14: "EIP-7702 is recommended for kernel
// version >=0.3.3"), a constraint the type system doesn't catch.
const KERNEL_VERSION = zerodevConstants.KERNEL_V3_3;
const ENTRY_POINT = zerodevConstants.getEntryPoint('0.7');

function getZeroDevRpc(): string {
  const rpc = process.env.NEXT_PUBLIC_ZERODEV_RPC;
  if (!rpc) {
    throw new Error('NEXT_PUBLIC_ZERODEV_RPC is not set — copy the RPC URL from your ZeroDev dashboard project page');
  }
  return rpc;
}

// One EIP-7702-delegated Kernel account, wired with two validators: an
// ECDSA "sudo" plugin for the account owner (the Magic/dev signer itself —
// unused by this function today, but installed because a real owner action
// needing full authority, if one's ever added, shouldn't require a second
// account rebuild), and a "regular" session-key plugin actually used to
// sign this batch. Built fresh per call rather than cached — construction
// is local/cheap until something is actually sent, and a cached account
// object outliving a logout/relogin is a stale-signer bug waiting to
// happen.
// `depositCap` is the shortfall this session key may deposit — 0 when the
// vault already covers the chosen funding target, in which case the
// approve/deposit permissions are left out of the policy entirely (the key
// has no business holding rights it'll never use this call).
async function buildSessionKernelClient(depositCap: bigint, expirySeconds: number) {
  const signer = getSigner();
  if (!signer) throw new Error('Not logged in — no signer available for the smart account');

  const publicClient = getPublicClient();
  const chain = getChain();

  // Real-Magic mode: Magic's sign7702Authorization is a bespoke SDK method,
  // not reachable through the generic EIP-1193 signer path, so it has to be
  // fetched explicitly. Dev-wallet mode's LocalAccount signs its own
  // authorization natively when create7702KernelAccount asks for it later —
  // no pre-fetch needed there.
  const eip7702Auth = isDevWallet
    ? undefined
    : await sign7702Authorization({
        contractAddress: zerodevConstants.KERNEL_7702_DELEGATION_ADDRESS,
        chainId: chain.id,
      });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  // The session key: a keypair generated fresh in the browser, never
  // persisted, scoped to exactly the three calls this batch makes — this
  // IS the "sign once" trick's second half (the first half is the 7702
  // delegation above).
  const sessionKeyAccount = privateKeyToAccount(generatePrivateKey());
  const sessionSigner = await toECDSASigner({ signer: sessionKeyAccount });

  const registryAddress = getRegistryAddress();
  const usdcAddress = getUsdcAddress();
  const vaultAddress = getVaultAddress();

  // Two separate calls rather than one array with a conditional spread —
  // TS can't hold the literal ParamCondition/Abi narrowing toCallPolicy's
  // generics need across a ternary-built array; each branch typechecks
  // cleanly on its own.
  const callPolicy =
    depositCap > 0n
      ? toCallPolicy({
          policyVersion: CallPolicyVersion.V0_0_4,
          permissions: [
            { abi: registryAbi, target: registryAddress, functionName: 'subscribe' },
            {
              abi: usdcAbi,
              target: usdcAddress,
              functionName: 'approve',
              args: [
                { condition: ParamCondition.EQUAL, value: vaultAddress },
                { condition: ParamCondition.LESS_THAN_OR_EQUAL, value: depositCap },
              ],
            },
            {
              abi: vaultAbi,
              target: vaultAddress,
              functionName: 'deposit',
              args: [
                { condition: ParamCondition.EQUAL, value: usdcAddress },
                { condition: ParamCondition.LESS_THAN_OR_EQUAL, value: depositCap },
              ],
            },
          ],
        })
      : toCallPolicy({
          policyVersion: CallPolicyVersion.V0_0_4,
          permissions: [{ abi: registryAbi, target: registryAddress, functionName: 'subscribe' }],
        });

  const now = Math.floor(Date.now() / 1000);
  const timestampPolicy = toTimestampPolicy({ validAfter: now, validUntil: now + expirySeconds });

  const sessionKeyValidator = await toPermissionValidator(publicClient, {
    signer: sessionSigner,
    policies: [callPolicy, timestampPolicy],
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  const account = await createKernelAccount(publicClient, {
    eip7702Account: signer,
    eip7702Auth,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    plugins: { sudo: ecdsaValidator, regular: sessionKeyValidator },
  });

  const rpc = http(getZeroDevRpc());
  const paymasterClient = createZeroDevPaymasterClient({ chain, transport: rpc });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: rpc,
    paymaster: paymasterClient,
  });

  return { kernelClient, vaultAddress, usdcAddress, registryAddress };
}

// The gasless-writes path (everything except Subscribe, which keeps its own
// session-key builder above): a Kernel account with ONLY the owner's sudo
// validator installed, no session key, no call-policy scoping, no expiry —
// full owner authority, still paid for by ZeroDev's paymaster. Gas
// sponsorship and session keys are separate concerns; only Subscribe needs
// the latter (so recurring UX needs zero signatures after the first one).
// Everything routed through this builder still requires a fresh signature
// exactly like a plain-EOA write did — the only thing that changes is who
// pays for gas, never who authorizes the call. Confirmed against the
// installed @zerodev/sdk types (KernelPluginManagerParams) that `sudo` and
// `regular` are both optional — sudo-only is a valid, standard construction.
async function buildOwnerKernelClient() {
  const signer = getSigner();
  if (!signer) throw new Error('Not logged in — no signer available for the smart account');

  const publicClient = getPublicClient();
  const chain = getChain();

  const eip7702Auth = isDevWallet
    ? undefined
    : await sign7702Authorization({
        contractAddress: zerodevConstants.KERNEL_7702_DELEGATION_ADDRESS,
        chainId: chain.id,
      });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  const account = await createKernelAccount(publicClient, {
    eip7702Account: signer,
    eip7702Auth,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    plugins: { sudo: ecdsaValidator },
  });

  const rpc = http(getZeroDevRpc());
  const paymasterClient = createZeroDevPaymasterClient({ chain, transport: rpc });

  return createKernelAccountClient({
    account,
    chain,
    bundlerTransport: rpc,
    paymaster: paymasterClient,
  });
}

// Submit → wait → check-success → decode-revert-on-failure, the same
// sequence subscribeAndFund below runs inline. Kept as a separate helper
// rather than refactoring subscribeAndFund to share it — that function is
// proven live against real Sepolia money movement (see frontend/plan.md's
// F4 error trail) and isn't worth touching to save a few lines.
async function sendSponsoredUserOp(calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[]) {
  const kernelClient = await buildOwnerKernelClient();

  let userOpHash: `0x${string}`;
  try {
    userOpHash = await kernelClient.sendUserOperation({ calls });
  } catch (e) {
    console.error('sendSponsoredUserOp: sendUserOperation rejected', e);
    throw e;
  }
  const userOpReceipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });

  if (!userOpReceipt.success) {
    const reason = userOpReceipt.reason ? decodeRevertData(userOpReceipt.reason) : 'no reason given';
    throw new Error(reason);
  }
  return userOpReceipt;
}

// Batches subscribe(planId) + (approve(vault, shortfall) + deposit(USDC,
// shortfall) — only if the vault doesn't already cover it) into one
// gas-sponsored UserOperation. `fundingAmount` is the TARGET vault balance
// the caller wants after this (e.g. "N months of runway"), not necessarily
// how much moves from the wallet — a subscriber who already has leftover
// escrow (a cancelled sub's unwithdrawn balance, a prior top-up) shouldn't
// get charged again for coverage they already have. `intervalSecs` sizes
// the session key's expiry ("a few intervals," per CONCEPT.md) — it never
// affects what the key can spend or where.
export async function subscribeAndFund(
  address: string,
  planId: number,
  fundingAmount: bigint,
  intervalSecs: number,
): Promise<{ subId: number; receipt: TxReceipt }> {
  const expirySeconds = intervalSecs * 3;
  const existingBalance = await getVaultBalance(address);
  const shortfall = fundingAmount > existingBalance ? fundingAmount - existingBalance : 0n;

  const { kernelClient, vaultAddress, usdcAddress, registryAddress } = await buildSessionKernelClient(
    shortfall,
    expirySeconds,
  );

  const calls = [
    {
      to: registryAddress,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'subscribe', args: [BigInt(planId)] }),
    },
    ...(shortfall > 0n
      ? [
          {
            to: usdcAddress,
            data: encodeFunctionData({ abi: usdcAbi, functionName: 'approve', args: [vaultAddress, shortfall] }),
          },
          {
            to: vaultAddress,
            data: encodeFunctionData({ abi: vaultAbi, functionName: 'deposit', args: [usdcAddress, shortfall] }),
          },
        ]
      : []),
  ];

  // Diagnostic-only: a bundler-side validation rejection ("Invalid fields
  // set on User Operation") is too generic to fix blind — found live
  // 2026-07-14 on a brand-new real-Magic account's first-ever UserOp
  // (dev-wallet's test address had already been 7702-delegated from
  // earlier testing, so it never exercised a fresh authorization the same
  // way). Logs the full error object — viem errors carry structured detail
  // (.details, .cause, .metaMessages) that .message alone truncates —
  // before re-throwing unchanged so walletErrorMessage still handles it.
  let userOpHash: `0x${string}`;
  try {
    userOpHash = await kernelClient.sendUserOperation({ calls });
  } catch (e) {
    console.error('subscribeAndFund: sendUserOperation rejected', e);
    throw e;
  }
  const userOpReceipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });

  // Mirrors writeContractSafely's status check in wallet.ts — a UserOp can
  // land mined but `success: false` (the batch's business logic reverted),
  // and that must never read as "funded." The bundler's `reason` is raw
  // ABI-encoded error data ("0x5fd8a132"), not a decoded message — run it
  // through the same custom-error catalog a plain-tx revert would hit, so
  // "you're already subscribed" reads the same either way (found live
  // 2026-07-14: this showed as the bare hex before the fix).
  if (!userOpReceipt.success) {
    const reason = userOpReceipt.reason ? decodeRevertData(userOpReceipt.reason) : 'no reason given';
    throw new Error(`Subscribe failed on-chain: ${reason}`);
  }

  const [event] = parseEventLogs({ abi: registryAbi, eventName: 'Subscribed', logs: userOpReceipt.logs });
  if (!event) throw new Error('subscribeAndFund() succeeded but no Subscribed event was found in the receipt');

  // UserOperationReceipt nests the real transaction receipt one level down
  // (.receipt.transactionHash / .blockNumber) — not at the top level like a
  // plain TransactionReceipt, which is what buildTxReceipt expects. Amount
  // is the shortfall (what actually moved), not fundingAmount (the target
  // balance) — the receipt should say what happened, not what was asked for.
  const receipt = await buildTxReceipt(userOpReceipt.receipt, vaultAddress, shortfall);

  return { subId: Number(event.args.subId), receipt };
}

// Everything below was a plain-EOA write in lib/wallet.ts until the gasless-
// writes pass — moved here (not left in wallet.ts calling into this file)
// because this file is the only one allowed to import @zerodev/sdk.
// Signatures and behavior are unchanged from the originals; only the
// submission path is different (sendSponsoredUserOp instead of
// writeContractSafely). `address`/`from` params are kept for call-site
// compatibility even though the signer now resolves internally via
// getSigner() inside buildOwnerKernelClient — they were always "who signs
// this," which is no longer the caller's job to specify.

export async function unsubscribe(address: string, subId: number): Promise<void> {
  const registryAddress = getRegistryAddress();
  await sendSponsoredUserOp([
    {
      to: registryAddress,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'unsubscribe', args: [BigInt(subId)] }),
    },
  ]);
}

// Approve only if the current allowance is short, then deposit — both calls
// batch into the same UserOp when both are needed, so this is at most one
// signature regardless (was up to two separate plain txs before).
export async function approveAndDeposit(address: string, amount: bigint): Promise<TxReceipt> {
  const usdc = getUsdcAddress();
  const vault = getVaultAddress();
  const account = address as `0x${string}`;

  const allowance = await getPublicClient().readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [account, vault],
  });

  const calls = [
    ...(allowance < amount
      ? [
          {
            to: usdc,
            data: encodeFunctionData({ abi: usdcAbi, functionName: 'approve', args: [vault, amount] }),
          },
        ]
      : []),
    {
      to: vault,
      data: encodeFunctionData({ abi: vaultAbi, functionName: 'deposit', args: [usdc, amount] }),
    },
  ];

  const userOpReceipt = await sendSponsoredUserOp(calls);
  return buildTxReceipt(userOpReceipt.receipt, vault, amount);
}

export async function withdraw(address: string, amount: bigint): Promise<TxReceipt> {
  const vault = getVaultAddress();
  const usdc = getUsdcAddress();
  const userOpReceipt = await sendSponsoredUserOp([
    {
      to: vault,
      data: encodeFunctionData({ abi: vaultAbi, functionName: 'withdraw', args: [usdc, amount] }),
    },
  ]);
  return buildTxReceipt(userOpReceipt.receipt, address, amount);
}

// The one action in the app that moves money OUT of Recurra's world
// entirely — a plain ERC-20 transfer from the user's own wallet to any
// address they type. F4.5's security rules, all enforced here at the
// boundary, not just in the UI:
// - destination must be a well-formed address (checksummed via
//   getAddress) BEFORE anything is signed — a typo must fail loudly,
//   never become unrecoverable
// - explicit zero-address block, belt-and-suspenders over the token's own
// - same simulate-then-write-then-check-receipt discipline as every other
//   write (sendSponsoredUserOp's success check plays that role here)
//
// PERMANENT SECURITY BOUNDARY (from frontend/plan.md F4.5): Send must NEVER
// be delegated to a session key. The session key's model is a fixed
// allowlist of known contracts; "send to whatever the user typed" is
// fundamentally incompatible with an allowlist. This function goes through
// buildOwnerKernelClient — sudo (full owner) only, no session key, ever —
// so gas sponsorship changes who pays, never who authorizes. Not a UX
// preference; do not revisit.
export async function transferUsdc(from: string, to: string, amount: bigint): Promise<TxReceipt> {
  if (!isAddress(to)) {
    throw new Error("That doesn't look like a valid address — check it and try again.");
  }
  const destination = getAddress(to); // checksummed, canonical
  if (destination === zeroAddress) {
    throw new Error('That is the zero address — funds sent there are gone forever.');
  }
  if (amount <= 0n) {
    throw new Error('Enter an amount greater than zero.');
  }
  const usdc = getUsdcAddress();
  const userOpReceipt = await sendSponsoredUserOp([
    {
      to: usdc,
      data: encodeFunctionData({ abi: usdcAbi, functionName: 'transfer', args: [destination, amount] }),
    },
  ]);
  return buildTxReceipt(userOpReceipt.receipt, destination, amount);
}
