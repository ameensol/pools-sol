pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
    A depositor posts a commitment when they enter the pool. When the withdraw, they must prove knowledge of the secret
    they used to construct the commitment.

    This commitment scheme allows for commitment re-use, because the nullifier is derived from the secret and the
    position of the commitment in the tree.

    This commitment contains metadata that can be used to offer multiple tokens and denominations in one
    tree of commitments, or it can be used to force a time delay by including a block timestamp into the commitment.
*/

template CommitmentNullifierHasher() {
    signal input secret; // secret is a random value that only the depositor knows
    signal input path; // path is the merkle tree index of the commitment in the deposit tree
    signal input metadata; // contains a digest of arbitrary data (eg, token, denomination, timestamp, sender)

    signal output commitment; // to be checked for inclusion in the deposit tree
    signal output nullifier;

    component rawCommitmentHasher = Poseidon(1);
    rawCommitmentHasher.inputs[0] <== secret;

    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== rawCommitmentHasher.out;
    commitmentHasher.inputs[1] <== metadata;
    commitment <== commitmentHasher.out;

    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== 1;
    nullifierHasher.inputs[2] <== path;
    nullifier <== nullifierHasher.out;
}