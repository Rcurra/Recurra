// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// Holds subscriber funds in escrow — the custody, dumb by design. It knows
/// no plans, no schedules, no "why": money leaves only via the Executor's
/// debit() or back to its owner via withdraw(). If every other contract
/// vanished, subscribers could still withdraw every cent.
contract SubscriptionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // subscriber → token → escrowed balance. The ledger: the actual tokens
    // sit at this contract's address; this records whose is whose. Public so
    // the auto-getter serves the backend's binding — do not rename.
    mapping(address => mapping(address => uint256)) public balances;

    // The PaymentExecutor — the only address allowed to call debit().
    // Wired once at deploy, then immutable in practice (same as Registry).
    address public executor;

    event Deposited(address indexed subscriber, address indexed token, uint256 amount);
    event Debited(address indexed subscriber, address indexed token, uint256 amount, address recipient);
    event Withdrawn(address indexed subscriber, address indexed token, uint256 amount);

    error ZeroAmount(); // deposit/withdraw/debit of 0
    error InsufficientBalance(); // withdraw/debit exceeds escrowed balance

    constructor() Ownable(msg.sender) {}

    /// Escrow funds for future charges. Deposits are always to the caller's
    /// own balance — msg.sender on both sides, so there is no parameter to
    /// abuse. Requires the usual ERC-20 approve beforehand (the frontend
    /// batches approve + deposit under the session key's one signature).
    ///
    /// Inbound flow, so the ledger is credited AFTER the pull: if a token
    /// with transfer hooks re-enters mid-transfer, it finds no balance to
    /// withdraw — and nonReentrant blocks the attempt outright. Atomicity
    /// covers the rest: a failed pull reverts the whole call, so the ledger
    /// can never be ahead of tokens actually received.
    ///
    /// Balance is credited by the amount requested — fee-on-transfer tokens
    /// are out of scope (USDC-first, documented).
    function deposit(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    /// Take escrow back — anytime, all of it if wanted. The only checks are
    /// arithmetic; deliberately NO policy checks (invariant #3): not "are you
    /// subscribed", no notice period, no pause switch. Uncommitted balance is
    /// the subscriber's, instantly — that's the bounded-loss pitch in code.
    /// An emptied vault simply makes future charges revert
    /// InsufficientVaultBalance in the Executor (a paused subscription).
    ///
    /// Outbound flow: ledger debited BEFORE the transfer (CEI), so any
    /// re-entering call already sees the reduced balance — and nonReentrant
    /// refuses the re-entry regardless.
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 balance = balances[msg.sender][token];
        if (balance < amount) revert InsufficientBalance();

        // unchecked: can't underflow, checked against balance above.
        unchecked {
            balances[msg.sender][token] = balance - amount;
        }
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    // TODO: setExecutor + debit (commit 3)
}
