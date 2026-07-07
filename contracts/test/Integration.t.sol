// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentExecutor} from "../src/PaymentExecutor.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {MockUSDC} from "../script/MockUSDC.sol";

/// The whole product in one file: the exact flows the demo walks through,
/// run against the full three-contract wiring with real (mock) USDC moving.
contract IntegrationTest is Test {
    SubscriptionRegistry registry;
    SubscriptionVault vault;
    PaymentExecutor executor;
    MockUSDC usdc;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address scheduler = makeAddr("scheduler");

    uint256 constant AMOUNT = 10e6; // 10 USDC / cycle
    uint256 constant INTERVAL = 30 days;
    uint256 constant FUND = 60e6; // 6 cycles of runway
    uint256 constant T0 = 1_750_000_000;

    function setUp() public {
        vm.warp(T0);
        registry = new SubscriptionRegistry();
        vault = new SubscriptionVault();
        executor = new PaymentExecutor(address(registry), address(vault));
        registry.setExecutor(address(executor));
        vault.setExecutor(address(executor));
        executor.setAuthorizedExecutor(scheduler);
        usdc = new MockUSDC();
    }

    /// createPlan → subscribe → deposit → charge → warp a cycle → charge
    /// again → cancel → withdraw. Every balance asserted at every step.
    function test_fullLifecycle_twoCyclesThenExit() public {
        // merchant publishes the offer
        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), AMOUNT, INTERVAL);

        // alice onboards: subscribe + fund (the batched UserOp, unbatched here)
        usdc.mint(alice, FUND);
        vm.startPrank(alice);
        uint256 subId = registry.subscribe(planId);
        usdc.approve(address(vault), FUND);
        vault.deposit(address(usdc), FUND);
        vm.stopPrank();

        assertTrue(registry.isDue(subId), "first charge due immediately");

        // cycle 1 — the scheduler notices and fires
        vm.prank(scheduler);
        executor.executePayment(subId);
        assertEq(usdc.balanceOf(merchant), AMOUNT);
        assertEq(vault.balances(alice, address(usdc)), FUND - AMOUNT);
        assertFalse(registry.isDue(subId), "quiet until next cycle");

        // time passes — nobody does anything, nobody needs to
        vm.warp(T0 + INTERVAL);
        assertTrue(registry.isDue(subId), "cycle 2 arrives on schedule");

        // cycle 2
        vm.prank(scheduler);
        executor.executePayment(subId);
        assertEq(usdc.balanceOf(merchant), 2 * AMOUNT);
        assertEq(vault.balances(alice, address(usdc)), FUND - 2 * AMOUNT);
        (,, uint256 due,) = registry.subscriptions(subId);
        assertEq(due, T0 + 2 * INTERVAL, "anchored, no drift");

        // alice leaves: no permission needed, remainder to the cent
        vm.startPrank(alice);
        registry.unsubscribe(subId);
        vault.withdraw(address(usdc), FUND - 2 * AMOUNT);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), FUND - 2 * AMOUNT, "paid exactly two cycles, ever");
        assertEq(usdc.balanceOf(address(vault)), 0, "vault owes nothing, holds nothing");

        // and the schedule is truly dead
        vm.warp(T0 + 10 * INTERVAL);
        assertFalse(registry.isDue(subId));
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.SubscriptionInactive.selector);
        executor.executePayment(subId);
    }

    /// Two scheduler ticks race for the same due payment: exactly one charge
    /// lands, the loser bounces off NotDue. This is why the backend needs no
    /// database — idempotency lives on-chain.
    function test_racingTicks_exactlyOneCharge() public {
        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), AMOUNT, INTERVAL);
        usdc.mint(alice, FUND);
        vm.startPrank(alice);
        uint256 subId = registry.subscribe(planId);
        usdc.approve(address(vault), FUND);
        vault.deposit(address(usdc), FUND);
        vm.stopPrank();

        vm.prank(scheduler);
        executor.executePayment(subId); // tick A wins

        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.NotDue.selector);
        executor.executePayment(subId); // tick B loses, harmlessly

        assertEq(usdc.balanceOf(merchant), AMOUNT, "charged exactly once");
    }

    /// A subscriber who goes underfunded is paused, not indebted: the charge
    /// fails while empty, then a top-up makes the SAME due payment succeed —
    /// and missed cycles in between are forgiven, never batch-collected.
    function test_underfundedPausesThenTopUpResumes_noBackCharges() public {
        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), AMOUNT, INTERVAL);
        usdc.mint(alice, 3 * AMOUNT);
        vm.startPrank(alice);
        uint256 subId = registry.subscribe(planId);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(address(usdc), AMOUNT); // fund exactly one cycle
        vm.stopPrank();

        vm.prank(scheduler);
        executor.executePayment(subId); // cycle 1 OK, escrow now 0

        // three cycles pass unfunded; every tick fails harmlessly
        vm.warp(T0 + 3 * INTERVAL);
        assertTrue(registry.isDue(subId));
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.InsufficientVaultBalance.selector);
        executor.executePayment(subId);

        // alice tops up two cycles' worth — only ONE charge fires now
        vm.prank(alice);
        vault.deposit(address(usdc), 2 * AMOUNT);
        vm.prank(scheduler);
        executor.executePayment(subId);

        assertEq(usdc.balanceOf(merchant), 2 * AMOUNT, "cycle 1 + resume; missed cycles forgiven");
        assertEq(vault.balances(alice, address(usdc)), AMOUNT, "one cycle left in escrow");

        // and the next due date re-anchored from the resume moment
        (,, uint256 due,) = registry.subscriptions(subId);
        assertEq(due, T0 + 3 * INTERVAL + INTERVAL, "now + interval, not back-dated");
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.NotDue.selector);
        executor.executePayment(subId); // no immediate second collection
    }
}
