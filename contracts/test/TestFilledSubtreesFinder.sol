// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// This test file is used to compare between js and solidity and estimate the gas
// of this function.
// The gas cost is whatever the average gas is in hardhat-gas-reporter, minus
// the base fee (21000). Probably slightly less as well given that there's
// a function selector here.
contract TestFilledSubtreesFinder {
    function getFilledSubtreeIndex(uint256 elementIndex, uint256 layerIndex)
        public
        pure
        returns (uint256 filledSubtreeIndex)
    {
        unchecked {
            filledSubtreeIndex = 2 * (elementIndex / (1 << (layerIndex + 1)));
        }
    }

    // this is a cheap hack to get the hardhat-gas-reporter plugin to estimate
    // the gas of this function during the unit test
    function getFilledSubtreeIndexGasEstimate(
        uint256 elementIndex,
        uint256 layerIndex
    ) public payable returns (uint256 filledSubtreeIndex) {
        unchecked {
            filledSubtreeIndex = 2 * (elementIndex / (1 << (layerIndex + 1)));
        }
    }
}
