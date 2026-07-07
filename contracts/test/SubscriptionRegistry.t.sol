// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {ExecutorWired} from "../src/ExecutorWired.sol";

contract SubscriptionRegistryTest is Test {
    SubscriptionRegistry registry;

    // The registry never calls the token contract, so a bare address works.
    address token = makeAddr("usdc");
    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address executor = makeAddr("executor");

    uint256 constant AMOUNT = 10e6; // 10 USDC (6 decimals)
    uint256 constant INTERVAL = 30 days;
    uint256 constant T0 = 1_750_000_000; // realistic base timestamp

    function setUp() public {
        vm.warp(T0);
        registry = new SubscriptionRegistry(); // owner = this test contract
        registry.setExecutor(executor);
        // setExecutor tests use their own fresh instance (wiring is one-time).
    }

    // --- helpers ---

    function _createPlan() internal returns (uint256 planId) {
        vm.prank(merchant);
        planId = registry.createPlan(token, AMOUNT, INTERVAL);
    }

    function _subscribe(address subscriber, uint256 planId) internal returns (uint256 subId) {
        vm.prank(subscriber);
        subId = registry.subscribe(planId);
    }

    function _nextPaymentDue(uint256 subId) internal view returns (uint256 due) {
        (,, due,) = registry.subscriptions(subId);
    }

    // --- createPlan ---

    function test_createPlan_storesPlanAndEmits() public {
        vm.expectEmit(true, true, false, false);
        emit SubscriptionRegistry.PlanCreated(1, merchant);

        uint256 planId = _createPlan();

        assertEq(planId, 1, "ids start at 1");
        (address m, address t, uint256 a, uint256 i, bool active) = registry.plans(planId);
        assertEq(m, merchant);
        assertEq(t, token);
        assertEq(a, AMOUNT);
        assertEq(i, INTERVAL);
        assertTrue(active);
        assertEq(registry.nextPlanId(), 2);
    }

    function test_createPlan_revertsOnZeroToken() public {
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(address(0), AMOUNT, INTERVAL);
    }

    function test_createPlan_revertsOnZeroAmount() public {
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(token, 0, INTERVAL);
    }

    function test_createPlan_revertsOnZeroInterval() public {
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(token, AMOUNT, 0);
    }

    function test_createPlan_revertsOnAbsurdInterval() public {
        // just over the 10-year cap; the boundary itself is fine
        vm.expectRevert(SubscriptionRegistry.InvalidPlanParams.selector);
        registry.createPlan(token, AMOUNT, 3650 days + 1);

        registry.createPlan(token, AMOUNT, 3650 days);
    }

    // --- deactivatePlan ---

    function test_deactivatePlan_merchantOnly_happyPath() public {
        uint256 planId = _createPlan();

        vm.expectEmit(true, false, false, false);
        emit SubscriptionRegistry.PlanDeactivated(planId);

        vm.prank(merchant);
        registry.deactivatePlan(planId);

        (,,,, bool active) = registry.plans(planId);
        assertFalse(active);
    }

    function test_deactivatePlan_revertsForNonMerchant() public {
        uint256 planId = _createPlan();
        vm.prank(alice);
        vm.expectRevert(SubscriptionRegistry.NotPlanMerchant.selector);
        registry.deactivatePlan(planId);
    }

    function test_deactivatePlan_revertsOnNonexistentPlan() public {
        vm.expectRevert(SubscriptionRegistry.PlanNotActive.selector);
        registry.deactivatePlan(999);
    }

    function test_deactivatePlan_revertsOnDoubleDeactivate() public {
        uint256 planId = _createPlan();
        vm.startPrank(merchant);
        registry.deactivatePlan(planId);
        vm.expectRevert(SubscriptionRegistry.PlanNotActive.selector);
        registry.deactivatePlan(planId);
        vm.stopPrank();
    }

    // --- subscribe ---

    function test_subscribe_storesSubAndEmits() public {
        uint256 planId = _createPlan();

        vm.expectEmit(true, true, true, false);
        emit SubscriptionRegistry.Subscribed(1, alice, planId);

        uint256 subId = _subscribe(alice, planId);

        assertEq(subId, 1);
        (uint256 p, address s, uint256 due, bool active) = registry.subscriptions(subId);
        assertEq(p, planId);
        assertEq(s, alice);
        assertEq(due, T0, "first payment due immediately");
        assertTrue(active);
        assertTrue(registry.hasActiveSubscription(alice, planId));
        assertEq(registry.nextSubId(), 2);
    }

    function test_subscribe_revertsOnDoubleSubscribe() public {
        uint256 planId = _createPlan();
        _subscribe(alice, planId);
        vm.prank(alice);
        vm.expectRevert(SubscriptionRegistry.AlreadySubscribed.selector);
        registry.subscribe(planId);
    }

    function test_subscribe_revertsOnNonexistentPlan() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionRegistry.PlanNotActive.selector);
        registry.subscribe(999);
    }

    function test_subscribe_revertsAfterPlanDeactivated() public {
        uint256 planId = _createPlan();
        vm.prank(merchant);
        registry.deactivatePlan(planId);

        vm.prank(alice);
        vm.expectRevert(SubscriptionRegistry.PlanNotActive.selector);
        registry.subscribe(planId);
    }

    // --- unsubscribe ---

    function test_unsubscribe_roundTrip() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);

        vm.expectEmit(true, false, false, false);
        emit SubscriptionRegistry.Unsubscribed(subId);

        vm.prank(alice);
        registry.unsubscribe(subId);

        (,,, bool active) = registry.subscriptions(subId);
        assertFalse(active);
        assertFalse(registry.hasActiveSubscription(alice, planId), "door reopened");
    }

    function test_unsubscribe_thenResubscribeGetsNewSub() public {
        uint256 planId = _createPlan();
        uint256 first = _subscribe(alice, planId);

        vm.prank(alice);
        registry.unsubscribe(first);

        uint256 second = _subscribe(alice, planId);
        assertEq(second, 2, "fresh id, old one stays as history");
        assertTrue(registry.hasActiveSubscription(alice, planId));
    }

    function test_unsubscribe_revertsForNonSubscriber() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);

        vm.prank(bob);
        vm.expectRevert(SubscriptionRegistry.NotSubscriber.selector);
        registry.unsubscribe(subId);
    }

    function test_unsubscribe_revertsOnDoubleUnsubscribe() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);

        vm.startPrank(alice);
        registry.unsubscribe(subId);
        vm.expectRevert(SubscriptionRegistry.SubscriptionNotActive.selector);
        registry.unsubscribe(subId);
        vm.stopPrank();
    }

    function test_unsubscribe_worksAfterPlanDeactivated() public {
        // a merchant killing their plan must never trap subscribers
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);

        vm.prank(merchant);
        registry.deactivatePlan(planId);

        vm.prank(alice);
        registry.unsubscribe(subId);
        (,,, bool active) = registry.subscriptions(subId);
        assertFalse(active);
    }

    // --- setExecutor (fresh instance: wiring in setUp is already spent) ---

    function test_setExecutor_ownerSetsOnceAndEmits() public {
        SubscriptionRegistry fresh = new SubscriptionRegistry();

        vm.expectEmit(false, false, false, true);
        emit ExecutorWired.ExecutorSet(executor);

        fresh.setExecutor(executor);
        assertEq(fresh.executor(), executor);
    }

    function test_setExecutor_revertsForNonOwner() public {
        SubscriptionRegistry fresh = new SubscriptionRegistry();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        fresh.setExecutor(executor);
    }

    function test_setExecutor_revertsOnZeroAddress() public {
        SubscriptionRegistry fresh = new SubscriptionRegistry();
        vm.expectRevert(ExecutorWired.ZeroAddress.selector);
        fresh.setExecutor(address(0));
    }

    function test_setExecutor_revertsOnSecondSet() public {
        SubscriptionRegistry fresh = new SubscriptionRegistry();
        fresh.setExecutor(executor);
        vm.expectRevert(ExecutorWired.ExecutorAlreadySet.selector);
        fresh.setExecutor(bob);
    }

    // --- markPaid: access control ---

    function test_markPaid_revertsForNonExecutor() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);

        // not even the owner (this test contract) may call it
        vm.expectRevert(ExecutorWired.NotExecutor.selector);
        registry.markPaid(subId);

        vm.prank(bob);
        vm.expectRevert(ExecutorWired.NotExecutor.selector);
        registry.markPaid(subId);
    }

    function test_markPaid_revertsOnCancelledSub() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);
        vm.prank(alice);
        registry.unsubscribe(subId);

        vm.prank(executor);
        vm.expectRevert(SubscriptionRegistry.SubscriptionNotActive.selector);
        registry.markPaid(subId);
    }

    function test_markPaid_revertsOnNonexistentSub() public {
        vm.prank(executor);
        vm.expectRevert(SubscriptionRegistry.SubscriptionNotActive.selector);
        registry.markPaid(999);
    }

    // --- markPaid: due-date math (invariant #2) ---

    function test_markPaid_onTime_advancesAnchored() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId); // due = T0

        vm.expectEmit(true, false, false, true);
        emit SubscriptionRegistry.PaymentRecorded(subId, T0 + INTERVAL);

        vm.prank(executor);
        registry.markPaid(subId);

        assertEq(_nextPaymentDue(subId), T0 + INTERVAL);
    }

    function test_markPaid_slightlyLate_staysAnchored() public {
        // scheduler lag must never drift the schedule
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId); // due = T0

        vm.warp(T0 + 3 hours);
        vm.prank(executor);
        registry.markPaid(subId);

        assertEq(_nextPaymentDue(subId), T0 + INTERVAL, "anchored to schedule, not to charge time");
    }

    function test_markPaid_wayOverdue_reanchorsFromNow() public {
        // missed cycles are forgiven, never batch-collected
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId); // due = T0

        vm.warp(T0 + 3 * INTERVAL); // two full cycles missed
        vm.prank(executor);
        registry.markPaid(subId);

        assertEq(_nextPaymentDue(subId), T0 + 4 * INTERVAL, "now + interval, skipped cycles gone");
    }

    function test_markPaid_exactlyOneIntervalLate_takesForgivenessBranch() public {
        // the boundary: anchored += would set the next due date to *now*,
        // firing a second charge immediately (batch collection). Must forgive.
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId); // due = T0

        vm.warp(T0 + INTERVAL);
        vm.prank(executor);
        registry.markPaid(subId);

        assertEq(_nextPaymentDue(subId), T0 + 2 * INTERVAL);
        assertFalse(registry.isDue(subId), "must not be immediately chargeable again");
    }

    function test_markPaid_secondCycleAdvancesAgain() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);

        vm.prank(executor);
        registry.markPaid(subId); // due -> T0 + INTERVAL

        vm.warp(T0 + INTERVAL);
        vm.prank(executor);
        registry.markPaid(subId); // on time: anchored

        assertEq(_nextPaymentDue(subId), T0 + 2 * INTERVAL);
    }

    // --- isDue truth table ---

    function test_isDue_trueWhenActiveAndDue() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);
        assertTrue(registry.isDue(subId), "first payment due at subscribe time");
    }

    function test_isDue_falseWhenNotYetDue() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);
        vm.prank(executor);
        registry.markPaid(subId);

        assertFalse(registry.isDue(subId));

        vm.warp(T0 + INTERVAL); // reaches the due date again
        assertTrue(registry.isDue(subId));
    }

    function test_isDue_falseWhenSubCancelled() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);
        vm.prank(alice);
        registry.unsubscribe(subId);

        assertFalse(registry.isDue(subId), "due by time, but sub is cancelled");
    }

    function test_isDue_falseWhenPlanDeactivated() public {
        uint256 planId = _createPlan();
        uint256 subId = _subscribe(alice, planId);
        vm.prank(merchant);
        registry.deactivatePlan(planId);

        assertFalse(registry.isDue(subId), "due by time, but plan is dead");
    }

    function test_isDue_falseForNonexistentSub() public view {
        assertFalse(registry.isDue(999));
    }

    // --- getSubscriberSubs ---

    function test_getSubscriberSubs_emptyForStranger() public view {
        assertEq(registry.getSubscriberSubs(bob).length, 0);
    }

    function test_getSubscriberSubs_keepsCancelledAsHistory() public {
        uint256 planId = _createPlan();
        uint256 first = _subscribe(alice, planId);
        vm.prank(alice);
        registry.unsubscribe(first);
        uint256 second = _subscribe(alice, planId);

        uint256[] memory subs = registry.getSubscriberSubs(alice);
        assertEq(subs.length, 2, "cancelled sub stays as history");
        assertEq(subs[0], first);
        assertEq(subs[1], second);
    }
}
