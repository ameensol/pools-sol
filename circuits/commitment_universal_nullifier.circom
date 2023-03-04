pragma circom 2.0.3;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
    A depositor posts a commitment when they enter the pool. When the withdraw, they must prove knowledge of the secret
    they used to construct the commitment.

    This commitment scheme allows for commitment re-use, because the nullifier is derived from the secret and the
    position of the commitment in the tree.
*/
template CommitmentUniversalNullifier() {
    signal input secret; // secret is a random value that only the depositor knows
    signal input path; // path is the merkle tree index of the commitment in the deposit tree
    signal input contractCode; // contractCode uniquely identifies the contract that will be used to withdraw

    signal output commitment; // to be checked for inclusion in the deposit tree
    signal output nullifier; // unique to the deposit position and contract. prevents a double spend

    // compute the commitment
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== 0;
    commitmentHasher.inputs[1] <== secret;
    commitment <== commitmentHasher.out;

    // compute the nullifier
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== 0;
    nullifierHasher.inputs[1] <== secret;
    nullifierHasher.inputs[2] <== path;
    nullifierHasher.inputs[3] <== contractCode;
    nullifier <== nullifierHasher.out;
}
