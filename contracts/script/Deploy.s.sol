// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {PaymentExecutor} from "../src/PaymentExecutor.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// Full M2 deploy — one script, atomic wiring:
///   Registry -> Vault -> Executor(registry, vault)
///   -> registry.setExecutor + vault.setExecutor   (one-time, permanent)
///   -> executor.setAuthorizedExecutor(scheduler)  (rotatable)
///   -> MockUSDC (local/testnet only; real USDC on any future mainnet)
///
/// AUTHORIZED_EXECUTOR env selects the scheduler wallet (Openfort at M3);
/// unset, it defaults to the deployer so a single anvil key runs everything
/// locally (deployer == scheduler == anvil account #0).
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address scheduler = vm.envOr("AUTHORIZED_EXECUTOR", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);

        SubscriptionRegistry registry = new SubscriptionRegistry();
        SubscriptionVault vault = new SubscriptionVault();
        PaymentExecutor executor = new PaymentExecutor(address(registry), address(vault));

        registry.setExecutor(address(executor));
        vault.setExecutor(address(executor));
        executor.setAuthorizedExecutor(scheduler);

        MockUSDC usdc = new MockUSDC();

        vm.stopBroadcast();

        console.log("SubscriptionRegistry:", address(registry));
        console.log("SubscriptionVault:   ", address(vault));
        console.log("PaymentExecutor:     ", address(executor));
        console.log("MockUSDC:            ", address(usdc));
        console.log("authorizedExecutor:  ", scheduler);
    }
}
