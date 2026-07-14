// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionRegistry} from "../src/SubscriptionRegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {PaymentExecutor} from "../src/PaymentExecutor.sol";
import {MockUSDC} from "../script/MockUSDC.sol";

/// The only contract the invariant fuzzer calls into. Every input is bounded
/// to something that can't revert for a reason unrelated to the invariant
/// (withdraw never exceeds a real balance, deposit always mints what it
/// needs first), so every accepted call is a legitimate exercise of one of
/// the vault's three money paths: deposit, withdraw, and debit — the last one
/// only reachable the real way, through a genuine executePayment on a due,
/// funded subscription, exactly as production traffic would trigger it.
contract VaultInvariantHandler is Test {
    SubscriptionVault public vault;
    PaymentExecutor public executor;
    MockUSDC public usdc;
    address public scheduler;

    address[] public actors;
    uint256[] public subIds;

    constructor(
        SubscriptionVault vault_,
        PaymentExecutor executor_,
        MockUSDC usdc_,
        address scheduler_,
        address[] memory actors_,
        uint256[] memory subIds_
    ) {
        vault = vault_;
        executor = executor_;
        usdc = usdc_;
        scheduler = scheduler_;
        for (uint256 i = 0; i < actors_.length; i++) {
            actors.push(actors_[i]);
            subIds.push(subIds_[i]);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) public {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 100_000e6);
        usdc.mint(actor, amount);
        vm.startPrank(actor);
        usdc.approve(address(vault), amount);
        vault.deposit(address(usdc), amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amount) public {
        address actor = actors[actorSeed % actors.length];
        uint256 balance = vault.balances(actor, address(usdc));
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        vm.prank(actor);
        vault.withdraw(address(usdc), amount);
    }

    /// Time only ever moves forward — same as the real chain — so this
    /// doubles as the "many warped cycles" driver for whichever subs happen
    /// to be due and funded when the fuzzer picks this call.
    function warpAndExecute(uint256 subSeed, uint256 warpSeconds) public {
        uint256 subId = subIds[subSeed % subIds.length];
        warpSeconds = bound(warpSeconds, 0, 400 days);
        vm.warp(block.timestamp + warpSeconds);
        vm.prank(scheduler);
        // Expected to revert plenty (NotDue, InsufficientVaultBalance) —
        // that's the point: those are the vault staying exactly as funded.
        try executor.executePayment(subId) {} catch {}
    }
}

/// M4 hardening — the vault invariant named in plan.md: the ledger's sum of
/// per-subscriber balances must always equal the token's actual balance of
/// the vault contract. If these two numbers ever diverge, either some
/// subscriber's money went unaccounted for, or the vault is promising more
/// than it holds — the one failure mode the "always yours, to the cent"
/// pitch depends on never happening, across any sequence of deposits,
/// withdrawals, and real payment executions.
contract VaultInvariantTest is Test {
    SubscriptionRegistry registry;
    SubscriptionVault vault;
    PaymentExecutor executor;
    MockUSDC usdc;
    VaultInvariantHandler handler;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address scheduler = makeAddr("scheduler");

    function setUp() public {
        vm.warp(1_750_000_000);
        registry = new SubscriptionRegistry();
        vault = new SubscriptionVault();
        executor = new PaymentExecutor(address(registry), address(vault));
        registry.setExecutor(address(executor));
        vault.setExecutor(address(executor));
        executor.setAuthorizedExecutor(scheduler);
        usdc = new MockUSDC();

        vm.prank(merchant);
        uint256 planId = registry.createPlan(address(usdc), 10e6, 30 days);

        vm.prank(alice);
        uint256 aliceSub = registry.subscribe(planId);
        vm.prank(bob);
        uint256 bobSub = registry.subscribe(planId);

        address[] memory actors = new address[](2);
        actors[0] = alice;
        actors[1] = bob;
        uint256[] memory subIds = new uint256[](2);
        subIds[0] = aliceSub;
        subIds[1] = bobSub;

        handler = new VaultInvariantHandler(vault, executor, usdc, scheduler, actors, subIds);
        targetContract(address(handler));
    }

    function invariant_vaultBalanceMatchesLedgerSum() public view {
        uint256 ledgerSum = vault.balances(alice, address(usdc)) + vault.balances(bob, address(usdc));
        assertEq(usdc.balanceOf(address(vault)), ledgerSum, "vault custody must equal the sum of escrowed balances");
    }
}
