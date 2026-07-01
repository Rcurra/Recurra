// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SubscriptionRegistry.sol";

contract SubscriptionRegistryTest is Test {
    SubscriptionRegistry registry;

    function setUp() public {
        registry = new SubscriptionRegistry();
    }

    // TODO: test_createPlan, test_subscribe, test_unsubscribe, test_recordPayment
}
