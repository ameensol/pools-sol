// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IPrivacyPool {
    function deposit(bytes32) external returns (uint256);

    function withdraw(
        uint256[8] calldata flatProof,
        bytes32 root,
        bytes32 subsetRoot,
        bytes32 nullifier,
        address recipient,
        address relayer,
        uint256 fee
    ) external returns (bool);
}
