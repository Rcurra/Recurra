// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SubscriptionVault.sol";

contract SubscriptionVaultTest is Test {
    SubscriptionVault vault;
    address executor = address(0xBEEF);

    function setUp() public {
        vault = new SubscriptionVault(executor);
    }

    // TODO: test_deposit, test_debitOnlyByExecutor, test_withdraw
}
