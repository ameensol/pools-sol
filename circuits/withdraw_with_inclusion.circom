pragma circom 2.0.0;

include "./inclusion_proof.circom";
include "./commitment_simple.circom";

template WithdrawWithInclusion(levels) {
    /*
        Public Inputs
    */
    signal input commitmentsRoot; // root of the commitments tree
    signal input inclusionRoot; // root of the tree to prove inclusion in
    signal input nullifier; // prevent double spend
    signal input message; // arbitrary message data (recipient relayer fee data etc.)

    /*
        Private Inputs
    */
    signal input secret; // preimage of the commitment
    signal input path; // path of the commitment in its tree
    signal input proof[levels]; // merkle proof of leaf to recover commitments root

    // inclusion merkle proofs
    signal input inclusionPath; // path of commitment in inclusion tree
    signal input inclusionProof[levels]; // merkle proof of leaf to recover inclusion root

    // compute commitment and nullifier
    component hasher = CommitmentNullifierHasher();
    hasher.secret <== secret;
    hasher.path <== path;
    // constrain public nullifier is rightly derived from secret data
    nullifier === hasher.nullifier;

    // setup commitments tree
    component commitmentTree = InclusionProof(levels);
    commitmentTree.leaf <== hasher.commitment;
    commitmentTree.path <== path;
    for (var i = 0; i < levels; i++) {
        commitmentTree.proof[i] <== proof[i];

    }
    // constrain commitment is member of commitments tree
    commitmentsRoot === commitmentTree.root;

    // setup inclusion tree
    component inclusionTree = InclusionProof(levels);
    inclusionTree.leaf <== hasher.commitment;
    inclusionTree.path <== inclusionPath;
    for (var i = 0; i < levels; i++) {
        inclusionTree.proof[i] <== inclusionProof[i];
    }
    // constraint commitment is member of inclusion tree
    inclusionRoot === inclusionTree.root;

    // add arbitrary message to zkproof
    signal messageSquare;
    messageSquare <== message * message;
}

component main {
    public [
        commitmentsRoot,
        inclusionRoot,
        nullifier,
        message
    ]
} = WithdrawWithInclusion(20);