// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TemiToken (TMT)
/// @notice A fixed-supply ERC20 token. The entire supply is minted once to the
///         deployer at construction time. There is no owner, no mint function,
///         no pause, no blacklist and no transfer tax, so the total supply can
///         never change and no privileged account can interfere with transfers.
contract TemiToken is ERC20 {
    /// @notice Total supply in whole tokens, before decimals are applied.
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000;

    constructor() ERC20("TemiToken", "TMT") {
        _mint(msg.sender, INITIAL_SUPPLY * 10 ** decimals());
    }
}
