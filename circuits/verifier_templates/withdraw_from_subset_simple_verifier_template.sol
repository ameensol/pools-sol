// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./ProofLib.sol";

contract WithdrawFromSubsetSimpleVerifier {
    using ProofLib for ProofLib.G1Point;
    using ProofLib for ProofLib.G2Point;

    function withdrawFromSubsetSimpleVerifyingKey()
        internal
        pure
        returns (ProofLib.VerifyingKey memory vk)
    {
// VERIFYING_KEY
    }

    function _verifyWithdrawFromSubsetSimpleProof(
        uint256[8] calldata flatProof,
        uint256 root,
        uint256 subsetRoot,
        uint256 nullifier,
        uint256 message
    ) internal view returns (bool) {
        if (
            root >= ProofLib.SNARK_SCALAR_FIELD ||
            subsetRoot >= ProofLib.SNARK_SCALAR_FIELD ||
            nullifier >= ProofLib.SNARK_SCALAR_FIELD ||
            message >= ProofLib.SNARK_SCALAR_FIELD
        ) revert ProofLib__GteSnarkScalarField();

        ProofLib.Proof memory proof;
        proof.a = ProofLib.G1Point(flatProof[0], flatProof[1]);
        proof.b = ProofLib.G2Point(
            [flatProof[2], flatProof[3]],
            [flatProof[4], flatProof[5]]
        );
        proof.c = ProofLib.G1Point(flatProof[6], flatProof[7]);

        ProofLib.VerifyingKey memory vk = withdrawFromSubsetSimpleVerifyingKey();
        // solhint-disable-next-line var-name-mixedcase
        ProofLib.G1Point memory vk_x = ProofLib.G1Point(0, 0);
        vk_x = vk_x.addition(vk.IC[1].scalarMul(root));
        vk_x = vk_x.addition(vk.IC[2].scalarMul(subsetRoot));
        vk_x = vk_x.addition(vk.IC[3].scalarMul(nullifier));
        vk_x = vk_x.addition(vk.IC[4].scalarMul(message));
        vk_x = vk_x.addition(vk.IC[0]);
        return
            proof.a.negate().pairingProd4(
                proof.b,
                vk.alfa1,
                vk.beta2,
                vk_x,
                vk.gamma2,
                proof.c,
                vk.delta2
            );
    }
}
