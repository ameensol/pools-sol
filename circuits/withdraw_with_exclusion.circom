pragma circom 2.0.0;

include "./exclusion_proof.circom";
include "./inclusion_proof.circom";
include "./commitment_simple.circom";

template WithdrawWithExclusion(levels) {
    /*
        Public Inputs
    */
    signal input commitmentsRoot; // root of the commitments tree
    signal input exclusionRoot; // root of the tree to prove exclusion from
    signal input nullifier; // prevent double spend
    signal input message; // arbitrary message data (recipient relayer fee data etc.)

    /*
        Private Inputs
    */
    signal input secret; // preimage of the commitment
    signal input path; // path of the commitment in its tree
    signal input proof[levels]; // merkle proof of leaf to recover commitments root

    // exclusion merkle proofs
    signal input exclusionLowerPath; // path of lesser leaf in exclusion tree
    signal input exclusionLowerLeaf; // the lesser leaf than the excluded leaf
    signal input exclusionUpperLeaf; // the greater leaf than the excluded leaf
    signal input exclusionLowerProof[levels]; // merkle proof of lower leaf to recover exclusion root
    signal input exclusionUpperProof[levels]; // merkle proof of upper leaf to recover exclusion root

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

    // setup exclusion tree
    component exclusionTree = ExclusionProof(levels);
    exclusionTree.leaf <== hasher.commitment;
    exclusionTree.lowerLeaf <== exclusionLowerLeaf;
    exclusionTree.upperLeaf <== exclusionUpperLeaf;
    exclusionTree.lowerPath <== exclusionLowerPath;
    for (var i = 0; i < levels; i++) {
        exclusionTree.lowerProof[i] <== exclusionLowerProof[i];
        exclusionTree.upperProof[i] <== exclusionUpperProof[i];
    }
    // constraint commitment is not member of exclusion tree
    exclusionRoot === exclusionTree.root;

    // add arbitrary message to zkproof
    signal messageSquare;
    messageSquare <== message * message;
}

component main {
    public [
        commitmentsRoot,
        exclusionRoot,
        nullifier,
        message
    ]
} = WithdrawWithExclusion(20);