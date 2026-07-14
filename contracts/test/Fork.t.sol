// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentExecutor} from "../src/PaymentExecutor.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {MockUSDC} from "../script/MockUSDC.sol";

/// M4 hardening — the chain-agnosticism receipt from plan.md: the same
/// lifecycle Integration.t.sol proves on anvil's synthetic state, run
/// instead on a live fork of Arbitrum Sepolia. Anvil's block.timestamp
/// advances in perfect lockstep with vm.warp; a real L2 has sequencer
/// timing, real gas mechanics, and genuine historical state underneath —
/// this is what catches an assumption anvil was too clean to expose.
///
/// Forks locally (no broadcast, nothing touches the real chain); defaults
/// to Arbitrum Sepolia's public RPC (keyless, rate-limited but sufficient
/// for one deploy + a handful of calls) so `forge test --match-contract
/// ForkTest` reproduces this on its own. Override with a faster/private
/// endpoint via ARBITRUM_SEPOLIA_RPC_URL if the public one is ever down.
contract ForkTest is Test {
    SubscriptionRegistry registry;
    SubscriptionVault vault;
    PaymentExecutor executor;
    MockUSDC usdc;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address scheduler = makeAddr("scheduler");

    uint256 constant AMOUNT = 10e6; // 10 USDC / cycle
    uint256 constant INTERVAL = 30 days;
    uint256 constant FUND = 30e6; // 3 cycles of runway

    function setUp() public {
        string memory rpcUrl = vm.envOr("ARBITRUM_SEPOLIA_RPC_URL", string("https://sepolia-rollup.arbitrum.io/rpc"));
        vm.createSelectFork(rpcUrl);

        // Fresh deploy on top of the fork's real, current state — proves the
        // constructor/wiring path itself works against a live chain, not
        // just that pre-existing bytecode would.
        registry = new SubscriptionRegistry();
        vault = new SubscriptionVault();
        executor = new PaymentExecutor(address(registry), address(vault));
        registry.setExecutor(address(executor));
        vault.setExecutor(address(executor));
        executor.setAuthorizedExecutor(scheduler);
        usdc = new MockUSDC();
    }

    /// The whole product, once, on real L2 state: createPlan → subscribe →
    /// deposit → charge → warp a cycle → charge again → cancel → withdraw.
    /// Same assertions as Integration.t.sol's twoCycles test — the point
    /// isn't new behavior, it's confirming identical behavior somewhere that
    /// isn't anvil.
    function test_fullLifecycle_onArbitrumSepoliaFork() public {
        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), AMOUNT, INTERVAL);

        usdc.mint(alice, FUND);
        vm.startPrank(alice);
        uint256 subId = registry.subscribe(planId);
        usdc.approve(address(vault), FUND);
        vault.deposit(address(usdc), FUND);
        vm.stopPrank();

        assertTrue(registry.isDue(subId), "first charge due immediately");

        uint256 startTime = block.timestamp;

        vm.prank(scheduler);
        executor.executePayment(subId);
        assertEq(usdc.balanceOf(merchant), AMOUNT);
        assertEq(vault.balances(alice, address(usdc)), FUND - AMOUNT);
        assertFalse(registry.isDue(subId), "quiet until next cycle");

        vm.warp(startTime + INTERVAL);
        assertTrue(registry.isDue(subId), "cycle 2 arrives on schedule");

        vm.prank(scheduler);
        executor.executePayment(subId);
        assertEq(usdc.balanceOf(merchant), 2 * AMOUNT);
        assertEq(vault.balances(alice, address(usdc)), FUND - 2 * AMOUNT);
        (,, uint256 due,) = registry.subscriptions(subId);
        assertEq(due, startTime + 2 * INTERVAL, "anchored, no drift, even on real L2 timing");

        vm.startPrank(alice);
        registry.unsubscribe(subId);
        vault.withdraw(address(usdc), FUND - 2 * AMOUNT);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), FUND - 2 * AMOUNT, "paid exactly two cycles, ever");
        assertEq(usdc.balanceOf(address(vault)), 0, "vault owes nothing, holds nothing");
    }
}
