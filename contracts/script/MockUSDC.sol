// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test-only stand-in for USDC on anvil/Sepolia: 6 decimals like the real
/// thing (so amounts in demos read correctly, e.g. 10e6 = 10 USDC) and
/// mint-anyone so demo wallets can fund themselves. Lives in script/, not
/// src/ — it is deploy tooling, never part of the protocol.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // Unrestricted on purpose: local/testnet faucet. This token must never
    // be pointed at by a real plan outside dev environments.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
