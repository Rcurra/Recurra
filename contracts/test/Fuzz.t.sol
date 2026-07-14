// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {PaymentExecutor} from "../src/PaymentExecutor.sol";
import {MockUSDC} from "../script/MockUSDC.sol";

/// M4 hardening — property tests over the ranges the unit suite only spot-
/// checks by hand: plan parameter bounds, and due-date advancement across
/// arbitrarily many skipped cycles. Nothing here replaces the unit suite;
/// it widens the net around the same two invariants (#1 InvalidPlanParams
/// guards every unpayable plan shape, #2 markPaid never batch-collects).
contract FuzzTest is Test {
    SubscriptionRegistry registry;
    SubscriptionVault vault;
    PaymentExecutor executor;
    MockUSDC usdc;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address scheduler = makeAddr("scheduler");
    uint256 constant T0 = 1_750_000_000;
    uint256 constant MAX_INTERVAL = 3650 days;

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

    // ── createPlan bounds — one fuzz test per invalid dimension, so every ──
    // ── run actually hits the guard instead of drowning in vm.assume rejects ──

    function testFuzz_createPlan_rejectsZeroToken(uint256 amount, uint256 interval) public {
        amount = bound(amount, 1, type(uint128).max);
        interval = bound(interval, 1, MAX_INTERVAL);
        vm.prank(merchant);
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(address(0), amount, interval);
    }

    function testFuzz_createPlan_rejectsZeroAmount(uint256 interval) public {
        interval = bound(interval, 1, MAX_INTERVAL);
        vm.prank(merchant);
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(address(usdc), 0, interval);
    }

    function testFuzz_createPlan_rejectsZeroInterval(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        vm.prank(merchant);
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(address(usdc), amount, 0);
    }

    /// The overflow guard: any interval past 10 years is rejected, all the
    /// way up to type(uint256).max — the exact range that would otherwise
    /// let nextPaymentDue + interval wrap in markPaid.
    function testFuzz_createPlan_rejectsIntervalOverCap(uint256 amount, uint256 interval) public {
        amount = bound(amount, 1, type(uint128).max);
        interval = bound(interval, MAX_INTERVAL + 1, type(uint256).max);
        vm.prank(merchant);
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(address(usdc), amount, interval);
    }

    /// The flip side: any in-bounds combination succeeds and is stored
    /// exactly as given — the plan really is the source of truth the
    /// Executor reads amount/token/merchant from, never backend calldata.
    function testFuzz_createPlan_acceptsValidParams(uint256 amount, uint256 interval) public {
        amount = bound(amount, 1, type(uint128).max);
        interval = bound(interval, 1, MAX_INTERVAL);

        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), amount, interval);

        (address planMerchant, address token, uint256 planAmount, uint256 planInterval, bool active) =
            registry.plans(planId);
        assertEq(planMerchant, merchant);
        assertEq(token, address(usdc));
        assertEq(planAmount, amount);
        assertEq(planInterval, interval);
        assertTrue(active);
    }

    /// Invariant #2 over arbitrary time: however many intervals a charge is
    /// late by (0 = exactly on time, up to 50 = "way behind"), markPaid
    /// never batch-collects and the new due date is never left in the past.
    /// Encodes both branches of the due-date formula in
    /// SubscriptionRegistry.markPaid — the "anchored" (+= interval) and the
    /// "re-anchored" (now + interval) paths — across a wide interval range.
    function testFuzz_markPaid_neverBatchCollectsAcrossManySkippedCycles(
        uint256 amount,
        uint32 interval,
        uint8 cyclesLate,
        uint32 lateBySeconds
    ) public {
        amount = bound(amount, 1, 1_000_000e6);
        interval = uint32(bound(interval, 1 hours, MAX_INTERVAL));
        // Up to 50 fully skipped cycles covers "way behind" without the
        // warp target overflowing a reasonable block.timestamp.
        cyclesLate = uint8(bound(cyclesLate, 0, 50));
        lateBySeconds = uint32(bound(lateBySeconds, 0, uint256(interval) - 1));

        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), amount, interval);
        usdc.mint(alice, amount);
        vm.startPrank(alice);
        uint256 subId = registry.subscribe(planId);
        usdc.approve(address(vault), amount);
        vault.deposit(address(usdc), amount);
        vm.stopPrank();

        uint256 dueBefore = _dueOf(subId);
        assertEq(dueBefore, T0, "first charge due immediately");

        // Land at "cyclesLate full intervals + lateBySeconds" past due.
        uint256 elapsed = uint256(interval) * cyclesLate + lateBySeconds;
        vm.warp(T0 + elapsed);

        vm.prank(scheduler);
        executor.executePayment(subId);

        uint256 dueAfter = _dueOf(subId);

        if (elapsed >= interval) {
            // A full interval or more behind: re-anchored from now — the
            // skipped cycles are gone, never collected.
            assertEq(dueAfter, block.timestamp + interval, "re-anchor: now + interval");
        } else {
            // On time or slightly late (under one full interval): the
            // original schedule advances by exactly one interval, no drift.
            assertEq(dueAfter, dueBefore + interval, "anchored: due + interval, no drift");
        }

        // Whichever branch fired, the sub is immediately not-due again — a
        // second tick in the same instant can never double-collect.
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.NotDue.selector);
        executor.executePayment(subId);
    }

    function _dueOf(uint256 subId) internal view returns (uint256 due) {
        (,, due,) = registry.subscriptions(subId);
    }
}
