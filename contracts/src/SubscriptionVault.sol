// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Holds subscriber funds in escrow. Only PaymentExecutor can trigger debits.
contract SubscriptionVault {
    address public executor; // set at deploy time, only this address can call debit()

    // subscriber → token → balance
    mapping(address => mapping(address => uint256)) public balances;

    event Deposited(address indexed subscriber, address indexed token, uint256 amount);
    event Debited(address indexed subscriber, address indexed token, uint256 amount, address recipient);
    event Withdrawn(address indexed subscriber, address indexed token, uint256 amount);

    modifier onlyExecutor() {
        require(msg.sender == executor, "VaultError: caller is not executor");
        _;
    }

    constructor(address _executor) {
        executor = _executor;
    }

    // TODO: implement deposit, debit (onlyExecutor), withdraw, balanceOf
}
