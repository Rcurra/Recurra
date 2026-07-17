// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SubscriptionRegistry} from "./SubscriptionRegistry.sol";
import {SubscriptionVault} from "./SubscriptionVault.sol";

/// The law. Re-derives every payment's legitimacy from on-chain state (sub
/// active? plan active? actually due? escrow funded?) so no off-chain party —
/// including our own backend — is ever trusted with money decisions. A hacked
/// backend can at worst trigger a payment that was due anyway.
///
/// Stateless except three addresses: the two wired contracts (immutable) and
/// the operational trigger (rotatable). Holds no funds, stores no business
/// state. Session keys never touch this contract — they live at the ZeroDev
/// account layer (M0 decision; the old registerSessionKey idea is dead).
// Ownable2Step, not plain Ownable: losing ownership to a typo'd address
// would permanently freeze authorizedExecutor rotation — the one owner
// power that must survive. Two-step transfer makes that unlosable.
contract PaymentExecutor is Ownable2Step {
    SubscriptionRegistry public immutable registry;
    SubscriptionVault public immutable vault;

    // The Openfort TEE wallet — the only address that may trigger
    // executePayment. Rotatable by design (key ceremony, env switch,
    // compromise response), unlike the permanent Registry/Vault wiring:
    // contract links never legitimately change, signing keys do.
    address public authorizedExecutor;

    event AuthorizedExecutorSet(address executor);
    event PaymentExecuted(
        uint256 indexed subId, address indexed subscriber, address indexed merchant, address token, uint256 amount
    );

    error NotAuthorized(); // executePayment by anyone but authorizedExecutor
    error NotDue(); // charge attempted before nextPaymentDue (benign scheduler race)
    error SubscriptionInactive(); // cancelled sub OR deactivated plan
    error InsufficientVaultBalance(); // escrow can't cover the plan amount
    error ZeroAddress(); // constructor/rotation wiring to 0

    constructor(address registry_, address vault_) Ownable(msg.sender) {
        if (registry_ == address(0) || vault_ == address(0)) revert ZeroAddress();
        registry = SubscriptionRegistry(registry_);
        vault = SubscriptionVault(vault_);
    }

    /// Owner-only and deliberately repeatable — the one owner power that
    /// survives deployment. Bounded blast radius: even a malicious
    /// authorizedExecutor can only trigger payments that are actually due,
    /// at plan amounts, to plan merchants.
    function setAuthorizedExecutor(address newExecutor) external onlyOwner {
        if (newExecutor == address(0)) revert ZeroAddress();
        authorizedExecutor = newExecutor;
        emit AuthorizedExecutorSet(newExecutor);
    }

    /// The only entry point for moving a subscription payment. The backend
    /// sends nothing but the subId — every fact that decides whether and how
    /// money moves (amount, token, recipient, due-ness) is re-read from
    /// chain state right here (invariant #5). The four checks, in order:
    ///
    ///   1. caller is the authorized trigger
    ///   2. sub AND plan still active (one error covers both — the caller
    ///      can't act on the difference)
    ///   3. actually due — this is also what makes racing scheduler ticks
    ///      safe: the second tick reverts NotDue, so idempotency comes from
    ///      the chain, not backend bookkeeping
    ///   4. escrow covers the plan amount
    ///
    /// Then markPaid BEFORE debit — CEI at the system level: the schedule
    /// advances before money moves, so by the time any token code runs the
    /// sub is already not-due and a re-triggered payment bounces off check 3.
    function executePayment(uint256 subId) external {
        if (msg.sender != authorizedExecutor) revert NotAuthorized();

        (uint256 planId, address subscriber, uint256 nextPaymentDue, bool subActive) = registry.subscriptions(subId);
        (address merchant, address token, uint256 amount,, bool planActive) = registry.plans(planId);
        // A nonexistent sub reads as planId 0 / subActive false, so it lands
        // here too — no separate existence check needed.
        if (!subActive || !planActive) revert SubscriptionInactive();

        if (block.timestamp < nextPaymentDue) revert NotDue();

        if (vault.balances(subscriber, token) < amount) revert InsufficientVaultBalance();

        registry.markPaid(subId);
        vault.debit(subscriber, token, amount, merchant);

        emit PaymentExecuted(subId, subscriber, merchant, token, amount);
    }
}
