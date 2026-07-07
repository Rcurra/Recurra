// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {ExecutorWired} from "../src/ExecutorWired.sol";
import {MockUSDC} from "../script/MockUSDC.sol";

/// Minimal hostile ERC-20: lies about balances, returns true for everything,
/// and re-enters the vault mid-transfer — the shape of attack SafeERC20 alone
/// does not stop. Used to assert both reentrancy defenses (CEI ordering and
/// the nonReentrant mutex) actually hold.
contract ReentrantToken {
    enum Attack {
        None,
        OnTransfer, // fires during vault withdraw/debit payouts
        OnTransferFrom // fires during vault deposit pulls
    }

    SubscriptionVault public vault;
    Attack public attack;

    function arm(SubscriptionVault vault_, Attack attack_) external {
        vault = vault_;
        attack = attack_;
    }

    function transfer(address, uint256) external returns (bool) {
        if (attack == Attack.OnTransfer) {
            attack = Attack.None;
            vault.withdraw(address(this), 1); // re-entry attempt
        }
        return true;
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        if (attack == Attack.OnTransferFrom) {
            attack = Attack.None;
            vault.withdraw(address(this), 1); // re-entry attempt
        }
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}

contract SubscriptionVaultTest is Test {
    SubscriptionVault vault;
    MockUSDC usdc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address merchant = makeAddr("merchant");
    address executor = makeAddr("executor");

    uint256 constant FUND = 60e6; // 60 USDC

    function setUp() public {
        vault = new SubscriptionVault(); // owner = this test contract
        vault.setExecutor(executor);

        usdc = new MockUSDC();
        usdc.mint(alice, FUND);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal {
        vm.prank(who);
        vault.deposit(address(usdc), amount);
    }

    // --- deposit ---

    function test_deposit_creditsLedgerAndMovesTokens() public {
        vm.expectEmit(true, true, false, true);
        emit SubscriptionVault.Deposited(alice, address(usdc), FUND);

        _deposit(alice, FUND);

        assertEq(vault.balances(alice, address(usdc)), FUND, "ledger credited");
        assertEq(usdc.balanceOf(address(vault)), FUND, "tokens physically in vault");
        assertEq(usdc.balanceOf(alice), 0);
    }

    function test_deposit_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionVault.ZeroAmount.selector);
        vault.deposit(address(usdc), 0);
    }

    function test_deposit_revertsWithoutApproval() public {
        usdc.mint(bob, FUND); // bob never approved the vault
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(vault), 0, FUND)
        );
        vault.deposit(address(usdc), FUND);
        assertEq(vault.balances(bob, address(usdc)), 0, "no credit without tokens");
    }

    // --- withdraw ---

    function test_withdraw_partialAndFull() public {
        _deposit(alice, FUND);

        vm.expectEmit(true, true, false, true);
        emit SubscriptionVault.Withdrawn(alice, address(usdc), 20e6);
        vm.prank(alice);
        vault.withdraw(address(usdc), 20e6);
        assertEq(vault.balances(alice, address(usdc)), 40e6);
        assertEq(usdc.balanceOf(alice), 20e6);

        // the rest, to the cent — no policy check can stop it (invariant #3)
        vm.prank(alice);
        vault.withdraw(address(usdc), 40e6);
        assertEq(vault.balances(alice, address(usdc)), 0);
        assertEq(usdc.balanceOf(alice), FUND);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function test_withdraw_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionVault.ZeroAmount.selector);
        vault.withdraw(address(usdc), 0);
    }

    function test_withdraw_revertsOnInsufficientBalance() public {
        _deposit(alice, FUND);
        vm.prank(alice);
        vm.expectRevert(SubscriptionVault.InsufficientBalance.selector);
        vault.withdraw(address(usdc), FUND + 1);
    }

    function test_withdraw_cannotTouchOthersBalance() public {
        _deposit(alice, FUND);
        // bob has no ledger entry — his withdraw fails even though the vault
        // physically holds tokens (alice's)
        vm.prank(bob);
        vm.expectRevert(SubscriptionVault.InsufficientBalance.selector);
        vault.withdraw(address(usdc), 1);
    }

    // --- debit ---

    function test_debit_executorMovesEscrowToMerchant() public {
        _deposit(alice, FUND);

        vm.expectEmit(true, true, false, true);
        emit SubscriptionVault.Debited(alice, address(usdc), 10e6, merchant);

        vm.prank(executor);
        vault.debit(alice, address(usdc), 10e6, merchant);

        assertEq(vault.balances(alice, address(usdc)), 50e6);
        assertEq(usdc.balanceOf(merchant), 10e6);
    }

    function test_debit_revertsForNonExecutor() public {
        _deposit(alice, FUND);

        // not the owner, not the subscriber, not a stranger
        vm.expectRevert(ExecutorWired.NotExecutor.selector);
        vault.debit(alice, address(usdc), 10e6, merchant);

        vm.prank(alice);
        vm.expectRevert(ExecutorWired.NotExecutor.selector);
        vault.debit(alice, address(usdc), 10e6, merchant);
    }

    function test_debit_revertsOnZeroAmount() public {
        vm.prank(executor);
        vm.expectRevert(SubscriptionVault.ZeroAmount.selector);
        vault.debit(alice, address(usdc), 0, merchant);
    }

    function test_debit_revertsOnInsufficientBalance() public {
        _deposit(alice, 5e6); // less than one cycle
        vm.prank(executor);
        vm.expectRevert(SubscriptionVault.InsufficientBalance.selector);
        vault.debit(alice, address(usdc), 10e6, merchant);
    }

    // --- the bounded-loss story, at vault level ---

    function test_withdrawAfterDebit_remainderExactToTheCent() public {
        _deposit(alice, FUND);

        vm.prank(executor);
        vault.debit(alice, address(usdc), 10e6, merchant); // one cycle charged

        vm.prank(alice);
        vault.withdraw(address(usdc), 50e6); // everything else comes back

        assertEq(usdc.balanceOf(alice), 50e6, "max loss = exactly one cycle");
        assertEq(usdc.balanceOf(merchant), 10e6);
        assertEq(usdc.balanceOf(address(vault)), 0, "vault holds nothing extra");
    }

    // --- ledger isolation ---

    function test_balances_isolatedPerUserAndToken() public {
        MockUSDC other = new MockUSDC();
        other.mint(alice, 7e6);
        usdc.mint(bob, 9e6);
        vm.startPrank(alice);
        other.approve(address(vault), type(uint256).max);
        vault.deposit(address(usdc), FUND);
        vault.deposit(address(other), 7e6);
        vm.stopPrank();
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(address(usdc), 9e6);
        vm.stopPrank();

        assertEq(vault.balances(alice, address(usdc)), FUND);
        assertEq(vault.balances(alice, address(other)), 7e6);
        assertEq(vault.balances(bob, address(usdc)), 9e6);
        assertEq(vault.balances(bob, address(other)), 0);
    }

    // --- executor wiring (module covered by registry suite; pin this instance) ---

    function test_setExecutor_oneTimeOnVaultToo() public {
        vm.expectRevert(ExecutorWired.ExecutorAlreadySet.selector);
        vault.setExecutor(bob);
    }

    // --- reentrancy: a hostile token re-entering mid-transfer gets nowhere ---

    function test_reentrancy_blockedDuringDeposit() public {
        ReentrantToken evil = new ReentrantToken();
        evil.arm(vault, ReentrantToken.Attack.OnTransferFrom);

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vault.deposit(address(evil), 100);
    }

    function test_reentrancy_blockedDuringWithdraw() public {
        ReentrantToken evil = new ReentrantToken();
        evil.arm(vault, ReentrantToken.Attack.None);
        vm.prank(alice);
        vault.deposit(address(evil), 100); // clean deposit first

        evil.arm(vault, ReentrantToken.Attack.OnTransfer);
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vault.withdraw(address(evil), 50);

        assertEq(vault.balances(alice, address(evil)), 100, "attack rolled back whole tx");
    }

    function test_reentrancy_blockedDuringDebit() public {
        ReentrantToken evil = new ReentrantToken();
        evil.arm(vault, ReentrantToken.Attack.None);
        vm.prank(alice);
        vault.deposit(address(evil), 100);

        evil.arm(vault, ReentrantToken.Attack.OnTransfer);
        vm.prank(executor);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vault.debit(alice, address(evil), 10, merchant);

        assertEq(vault.balances(alice, address(evil)), 100, "attack rolled back whole tx");
    }
}
