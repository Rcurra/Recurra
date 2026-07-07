// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SubscriptionRegistry.sol";
import "../src/SubscriptionVault.sol";
import "../src/PaymentExecutor.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        SubscriptionRegistry registry = new SubscriptionRegistry();

        // executor address is set after PaymentExecutor deploys — vault holds the reference
        PaymentExecutor executor = new PaymentExecutor(address(registry), address(0));
        SubscriptionVault vault = new SubscriptionVault();

        // TODO: wire vault back into executor after deployment

        vm.stopBroadcast();

        console.log("Registry:", address(registry));
        console.log("Vault:   ", address(vault));
        console.log("Executor:", address(executor));
    }
}
