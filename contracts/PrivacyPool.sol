// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IncrementalMerkleTree.sol";
import "./verifiers/withdraw_from_subset_simple_verifier.sol";

error PrivacyPool__FeeExceedsDenomination();
error PrivacyPool__InvalidZKProof();
error PrivacyPool__MsgValueInvalid();
error PrivacyPool__NoteAlreadySpent();
error PrivacyPool__UnknownRoot();
error PrivacyPool__ZeroAddress();

// No tokens pool. The pool accepts only one denomination of ETH. (E.g. 1 ETH pool, 0.1 ETH pool, 10 ETH pool, etc.)
contract PrivacyPool is
    ReentrancyGuard,
    IncrementalMerkleTree,
    WithdrawFromSubsetSimpleVerifier
{
    using ProofLib for bytes;

    // the same commitment can be deposited multiple times, can search for which leafIndexes it has in the tree
    event Deposit(
        bytes32 indexed commitment,
        uint256 denomination,
        uint256 leafIndex,
        uint256 timestamp
    );
    // relayer, subsetRoot, and nullifier are indexed but recipient is always expected to be a new address
    event Withdrawal(
        address recipient,
        address indexed relayer,
        bytes32 indexed subsetRoot,
        bytes32 indexed nullifier,
        uint256 fee
    );

    // denomination of deposits and withdrawals for this pool
    uint256 public immutable denomination;
    // double spend records
    mapping(bytes32 => bool) public nullifiers;

    constructor(address poseidon, uint256 _denomination) IncrementalMerkleTree(poseidon) {
        denomination = _denomination;
    }

    /*
        Deposit `denomination` amount of ETH.
    */
    function deposit(bytes32 commitment) public payable nonReentrant returns (uint256) {
        if (msg.value != denomination) revert PrivacyPool__MsgValueInvalid();
        uint256 leafIndex = insert(commitment);
        emit Deposit(
            commitment,
            denomination,
            leafIndex,
            block.timestamp
        );
        return leafIndex;
    }

    /*
        Withdraw using zkProof.
    */
    function withdraw(
        uint256[8] calldata flatProof,
        bytes32 root,
        bytes32 subsetRoot,
        bytes32 nullifier,
        address recipient,
        address relayer,
        uint256 fee
    ) public nonReentrant returns (bool) {
        if (nullifiers[nullifier]) revert PrivacyPool__NoteAlreadySpent();
        if (!isKnownRoot(root)) revert PrivacyPool__UnknownRoot();
        if (fee > denomination) revert PrivacyPool__FeeExceedsDenomination();
        if (recipient == address(0) || relayer == address(0)) revert PrivacyPool__ZeroAddress();
        uint256 message = abi
            .encodePacked(recipient, relayer, fee)
            .snarkHash();
        if (
            !_verifyWithdrawFromSubsetSimpleProof(
                flatProof,
                uint256(root),
                uint256(subsetRoot),
                uint256(nullifier),
                message
            )
        ) revert PrivacyPool__InvalidZKProof();

        nullifiers[nullifier] = true;
        emit Withdrawal(recipient, relayer, subsetRoot, nullifier, fee);

        if (fee > 0) {
            unchecked {
                payable(recipient).transfer(denomination - fee);
            }
            payable(relayer).transfer(fee);
        } else {
            payable(recipient).transfer(denomination);
        }
        return true;
    }
}
