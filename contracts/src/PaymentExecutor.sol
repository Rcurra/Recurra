// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SubscriptionRegistry.sol";
import "./SubscriptionVault.sol";

// Receives payment triggers from the backend, verifies the session key is valid,
// and calls the vault to debit the subscriber and forward funds to the merchant.
contract PaymentExecutor {
    SubscriptionRegistry public registry;
    SubscriptionVault public vault;

    // session key → its spending permission hash (populated when subscriber approves)
    mapping(address => bytes32) public sessionKeyPermissions;

    event PaymentExecuted(uint256 indexed subId, address indexed subscriber, uint256 amount);
    event SessionKeyRegistered(address indexed subscriber, address indexed sessionKey);

    constructor(address _registry, address _vault) {
        registry = SubscriptionRegistry(_registry);
        vault = SubscriptionVault(_vault);
    }

    // TODO: implement registerSessionKey, executePayment (verifies key + calls vault.debit)
}
