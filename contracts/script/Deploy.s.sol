// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";

/// M1 deploy: Registry only — Vault and PaymentExecutor are still stubs.
/// M2 extends this same script with the full atomic wiring:
///   Registry -> Vault -> Executor(registry, vault)
///   -> registry.setExecutor(executor) + vault.setExecutor(executor)
///   -> executor.setAuthorizedExecutor(schedulerWallet)
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        SubscriptionRegistry registry = new SubscriptionRegistry();

        vm.stopBroadcast();

        console.log("SubscriptionRegistry:", address(registry));
    }
}
