// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PaymentExecutor.sol";
import "../src/SubscriptionRegistry.sol";
import "../src/SubscriptionVault.sol";

contract PaymentExecutorTest is Test {
    SubscriptionRegistry registry;
    SubscriptionVault vault;
    PaymentExecutor executor;

    function setUp() public {
        registry = new SubscriptionRegistry();
        executor = new PaymentExecutor(address(0), address(0)); // wired after deploy
        vault = new SubscriptionVault();
    }

    // TODO: test_executePayment_validSessionKey, test_executePayment_expiredKey, test_endToEnd
}
