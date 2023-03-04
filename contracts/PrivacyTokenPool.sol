// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IncrementalMerkleTree.sol";
import "./verifiers/withdraw_from_subset_verifier.sol";

error PrivacyTokenPool__FeeExceedsAmount();
error PrivacyTokenPool__InvalidZKProof();
error PrivacyTokenPool__MsgValueInvalid();
error PrivacyTokenPool__NoteAlreadySpent();
error PrivacyTokenPool__UnknownRoot();
error PrivacyTokenPool__ZeroAddress();

contract PrivacyTokenPool is
    ReentrancyGuard,
    IncrementalMerkleTree,
    WithdrawFromSubsetVerifier
{
    using ProofLib for bytes;
    using SafeERC20 for IERC20;

    // emit the raw commitment, stamped leaf, plus the data to reconstruct the stamped commitment
    event Deposit(
        bytes32 indexed commitment,
        bytes32 indexed leaf,
        address indexed token,
        uint256 amount,
        uint256 leafIndex,
        uint256 timestamp
    );
    // emit the subsetRoot with each withdrawal
    event Withdrawal(
        address recipient,
        address indexed relayer,
        bytes32 indexed subsetRoot,
        bytes32 nullifier,
        uint256 fee
    );

    // double spend records
    mapping(bytes32 => bool) public nullifiers;

    constructor(address poseidon) IncrementalMerkleTree(poseidon) {}

    /*
        Deposit any asset and any amount.
    */
    function deposit(
        bytes32 commitment,
        address token,
        uint256 amount
    ) public payable nonReentrant returns (uint256) {
        if (token == address(0)) revert PrivacyTokenPool__ZeroAddress();
        bytes32 assetMetadata = bytes32(abi.encodePacked(token, amount).snarkHash());
        bytes32 leaf = hasher.poseidon([commitment, assetMetadata]);
        uint256 leafIndex = insert(leaf);

        emit Deposit(
            commitment,
            leaf,
            token,
            amount,
            leafIndex,
            block.timestamp
        );

        if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            if (msg.value != amount) revert PrivacyTokenPool__MsgValueInvalid();
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        return leafIndex;
    }

    /*
        Withdraw using zkProof.
    */
    function withdrawFromSubset(
        uint256[8] calldata flatProof,
        bytes32 root,
        bytes32 subsetRoot,
        bytes32 nullifier,
        address token,
        uint256 amount,
        address recipient,
        uint256 refund,
        address relayer,
        uint256 fee
    ) public payable nonReentrant returns (bool) {
        if (nullifiers[nullifier]) revert PrivacyTokenPool__NoteAlreadySpent();
        if (!isKnownRoot(root)) revert PrivacyTokenPool__UnknownRoot();
        if (fee > amount) revert PrivacyTokenPool__FeeExceedsAmount();
        if (recipient == address(0) || relayer == address(0) || token == address(0)) revert PrivacyTokenPool__ZeroAddress();
        uint256 assetMetadata = abi.encodePacked(token, amount).snarkHash();
        uint256 withdrawMetadata = abi
            .encodePacked(recipient, refund, relayer, fee)
            .snarkHash();
        if (
            !_verifyWithdrawFromSubsetProof(
                flatProof,
                uint256(root),
                uint256(subsetRoot),
                uint256(nullifier),
                assetMetadata,
                withdrawMetadata
            )
        ) revert PrivacyTokenPool__InvalidZKProof();

        nullifiers[nullifier] = true;
        emit Withdrawal(recipient, relayer, subsetRoot, nullifier, fee);

        if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            if (msg.value != 0) revert PrivacyTokenPool__MsgValueInvalid();
            if (fee > 0) {
                unchecked {
                    payable(recipient).transfer(amount - fee);
                }
                payable(relayer).transfer(fee);
            } else {
                payable(recipient).transfer(amount);
            }
        } else {
            if (msg.value != refund) revert PrivacyTokenPool__MsgValueInvalid();
            if (refund > 0) {
                payable(recipient).transfer(refund);
            }
            if (fee > 0) {
                IERC20(token).safeTransfer(recipient, amount - fee);
                IERC20(token).safeTransfer(relayer, fee);
            } else {
                IERC20(token).safeTransfer(recipient, amount);
            }
        }

        return true;
    }
}
