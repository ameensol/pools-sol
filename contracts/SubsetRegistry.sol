// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./interface/PrivacyPool.sol";

contract SubsetRegistry {
  event Subset(
    bytes32 indexed subsetRoot,
    bytes32 indexed nullifier,
    address indexed pool,
    uint accessType,
    uint bitLength,
    bytes subsetData
  );

  address public owner;
  mapping (address => bool) public privacyPools;

  constructor() {
    owner = msg.sender;
  }

  function addPools(address[] calldata pools) public {
    require(msg.sender == owner, "Only owner.");
    uint l = pools.length;
    for (uint i; i < l;) {
      privacyPools[pools[i]] = true;
      unchecked { ++i; }
    }
  }

  function removePools(address[] calldata pools) public {
    require(msg.sender == owner, "Only owner.");
    uint l = pools.length;
    for (uint i; i < l;) {
      privacyPools[pools[i]] = false;
      unchecked { ++i; }
    }
  }

  function withdrawAndRecord(
    // metadata
    address privacyPool,
    uint accessType,
    uint bitLength,
    bytes calldata subsetData,
    // withdraw params
    uint[8] calldata flatProof,
    bytes32 root,
    bytes32 subsetRoot,
    bytes32 nullifier,
    address recipient,
    address relayer,
    uint256 fee
  ) public {
    require(privacyPools[privacyPool], "Unknown privacy pool.");
    require(IPrivacyPool(privacyPool).withdraw(
      flatProof,
      root,
      subsetRoot,
      nullifier,
      recipient,
      relayer,
      fee
    ), "Withdraw failed.");
    emit Subset(
      subsetRoot,
      nullifier,
      privacyPool,
      accessType,
      bitLength,
      subsetData
    );
  }
}
