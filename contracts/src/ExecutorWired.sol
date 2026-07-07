// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// One-time executor wiring, shared by SubscriptionRegistry (gates markPaid)
/// and SubscriptionVault (gates debit). One copy of the security-sensitive
/// boilerplate, audited once, inherited twice — the two contracts can never
/// drift apart on how the gate works.
///
/// Deliberately NOT used by PaymentExecutor: its authorizedExecutor looks
/// similar but is repeatable by design (Openfort key rotation). The contract
/// wiring here is permanent; the operational signer there is rotatable.
/// That difference is a feature, not duplication.
abstract contract ExecutorWired is Ownable {
    // The PaymentExecutor. Wired once at deploy, then immutable in practice.
    address public executor;

    event ExecutorSet(address executor);

    error NotExecutor(); // gated call by anyone but the PaymentExecutor
    error ExecutorAlreadySet(); // one-time wiring guard
    error ZeroAddress(); // wiring to 0 would burn the one-time slot

    constructor() Ownable(msg.sender) {}

    modifier onlyExecutor() {
        if (msg.sender != executor) revert NotExecutor();
        _;
    }

    /// One-time deploy wiring: points the inheriting contract's executor gate
    /// at the PaymentExecutor. Owner-only and unrepeatable — after this, not
    /// even the owner can redirect it.
    function setExecutor(address newExecutor) external onlyOwner {
        if (newExecutor == address(0)) revert ZeroAddress();
        if (executor != address(0)) revert ExecutorAlreadySet();
        executor = newExecutor;
        emit ExecutorSet(newExecutor);
    }
}
