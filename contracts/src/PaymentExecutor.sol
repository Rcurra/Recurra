// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
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
contract PaymentExecutor is Ownable {
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

    // TODO: executePayment (next commit)
}
