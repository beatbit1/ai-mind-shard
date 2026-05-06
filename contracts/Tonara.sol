// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Tonara — identity + payment + judging-proof token for the Tonara agent network
/// @notice Deployed on 0G Aristotle Mainnet (chain 16661).
contract Tonara is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("Tonara", "TONARA")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 1_000_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
