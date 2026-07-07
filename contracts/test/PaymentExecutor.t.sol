// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PaymentExecutor} from "../src/PaymentExecutor.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {MockUSDC} from "../script/MockUSDC.sol";

contract PaymentExecutorTest is Test {
    SubscriptionRegistry registry;
    SubscriptionVault vault;
    PaymentExecutor executor;
    MockUSDC usdc;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address scheduler = makeAddr("scheduler"); // the authorizedExecutor (Openfort wallet)

    uint256 constant AMOUNT = 10e6;
    uint256 constant INTERVAL = 30 days;
    uint256 constant FUND = 60e6;
    uint256 constant T0 = 1_750_000_000;

    uint256 planId;
    uint256 subId;

    function setUp() public {
        vm.warp(T0);

        // full production wiring, same order as Deploy.s.sol
        registry = new SubscriptionRegistry();
        vault = new SubscriptionVault();
        executor = new PaymentExecutor(address(registry), address(vault));
        registry.setExecutor(address(executor));
        vault.setExecutor(address(executor));
        executor.setAuthorizedExecutor(scheduler);

        usdc = new MockUSDC();

        vm.prank(merchant);
        planId = registry.createPlan(address(usdc), AMOUNT, INTERVAL);

        vm.startPrank(alice);
        subId = registry.subscribe(planId); // first charge due immediately
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        usdc.mint(alice, FUND);
        vm.prank(alice);
        vault.deposit(address(usdc), FUND);
    }

    // --- construction + rotation ---

    function test_constructor_revertsOnZeroAddresses() public {
        vm.expectRevert(PaymentExecutor.ZeroAddress.selector);
        new PaymentExecutor(address(0), address(vault));
        vm.expectRevert(PaymentExecutor.ZeroAddress.selector);
        new PaymentExecutor(address(registry), address(0));
    }

    function test_setAuthorizedExecutor_ownerOnly() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        executor.setAuthorizedExecutor(alice);
    }

    function test_setAuthorizedExecutor_revertsOnZero() public {
        vm.expectRevert(PaymentExecutor.ZeroAddress.selector);
        executor.setAuthorizedExecutor(address(0));
    }

    function test_setAuthorizedExecutor_isRepeatable() public {
        // deliberately NOT one-time — Openfort key rotation
        address newSigner = makeAddr("rotated");

        vm.expectEmit(false, false, false, true);
        emit PaymentExecutor.AuthorizedExecutorSet(newSigner);
        executor.setAuthorizedExecutor(newSigner);
        assertEq(executor.authorizedExecutor(), newSigner);

        // old signer is out, new one works
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.NotAuthorized.selector);
        executor.executePayment(subId);

        vm.prank(newSigner);
        executor.executePayment(subId);
    }

    // --- executePayment: the happy path ---

    function test_executePayment_movesMoneyAndAdvancesSchedule() public {
        vm.expectEmit(true, true, true, true);
        emit PaymentExecutor.PaymentExecuted(subId, alice, merchant, address(usdc), AMOUNT);

        vm.prank(scheduler);
        executor.executePayment(subId);

        assertEq(usdc.balanceOf(merchant), AMOUNT, "merchant paid");
        assertEq(vault.balances(alice, address(usdc)), FUND - AMOUNT, "escrow debited");
        (,, uint256 due,) = registry.subscriptions(subId);
        assertEq(due, T0 + INTERVAL, "schedule advanced");
        assertFalse(registry.isDue(subId), "not chargeable again");
    }

    // --- executePayment: the four gates ---

    function test_executePayment_revertsNotAuthorized() public {
        // not the owner (us), not the subscriber, not a stranger
        vm.expectRevert(PaymentExecutor.NotAuthorized.selector);
        executor.executePayment(subId);

        vm.prank(alice);
        vm.expectRevert(PaymentExecutor.NotAuthorized.selector);
        executor.executePayment(subId);
    }

    function test_executePayment_revertsNotDue() public {
        vm.prank(scheduler);
        executor.executePayment(subId); // charge the due payment

        // the racing-tick case: an immediate second attempt bounces
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.NotDue.selector);
        executor.executePayment(subId);
    }

    function test_executePayment_revertsOnCancelledSub() public {
        vm.prank(alice);
        registry.unsubscribe(subId);

        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.SubscriptionInactive.selector);
        executor.executePayment(subId);
    }

    function test_executePayment_revertsOnDeactivatedPlan() public {
        vm.prank(merchant);
        registry.deactivatePlan(planId);

        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.SubscriptionInactive.selector);
        executor.executePayment(subId);
    }

    function test_executePayment_revertsOnNonexistentSub() public {
        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.SubscriptionInactive.selector);
        executor.executePayment(999);
    }

    function test_executePayment_revertsOnInsufficientVaultBalance() public {
        // alice pulls her escrow before the charge — legal, invariant #3;
        // the charge then simply fails, no debt accrues
        vm.prank(alice);
        vault.withdraw(address(usdc), FUND);

        vm.prank(scheduler);
        vm.expectRevert(PaymentExecutor.InsufficientVaultBalance.selector);
        executor.executePayment(subId);
    }

    // --- the user's exit is never blocked ---

    function test_withdrawAfterCancel_systemLevel() public {
        vm.prank(scheduler);
        executor.executePayment(subId); // one cycle charged

        vm.startPrank(alice);
        registry.unsubscribe(subId);
        vault.withdraw(address(usdc), FUND - AMOUNT);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), FUND - AMOUNT, "everything but one cycle back");
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}
