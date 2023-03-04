pragma circom 2.0.0;

include "./common.circom";
include "./commitment_metadata.circom";
include "./shared_path_proof.circom";

template WithdrawFromSubsetAssetMetadata(levels, expectedValue) {
    /*
        Public Inputs
    */
    signal input root; // root of the commitments tree
    signal input subsetRoot; // root of the subset where the index of this commitment is approved
    signal input nullifier; // prevent double spend: nullifier = poseidon([secret, 1, path])
    signal input metadata; // metadata injected into the commitment during the deposit phase
    signal input message; // arbitrary message data (recipient relayer fee data etc.)

    /*
        Private Inputs
    */
    signal input secret; // preimage of the commitment
    signal input path; // path of the commitment in its tree
    signal input mainProof[levels]; // merkle proof of leaf to recover commitments root
    signal input subsetProof[levels]; // merkle proof of expected value to recover subset root

    // compute commitment and nullifier
    component hasher = CommitmentNullifierHasher();
    hasher.secret <== secret;
    hasher.path <== path;
    hasher.metadata <== metadata;
    // constrain nullifier is rightly derived from secret data
    nullifier === hasher.nullifier;

    // setup both merkle trees with a single template.
    // they share the path, ie the proofs are identical branches in parallel trees
    component doubleTree = SharedPathProof(levels, expectedValue);
    doubleTree.leaf <== hasher.commitment;
    doubleTree.path <== path;
    for (var i = 0; i < levels; i++) {
        doubleTree.mainProof[i] <== mainProof[i];
        doubleTree.subsetProof[i] <== subsetProof[i];
    }
    // constrain commitment is member of commitments tree
    root === doubleTree.root;
    // constrain index of commitment in subset contains the expected value
    subsetRoot === doubleTree.subsetRoot;

    // add arbitrary message to zkproof
    signal messageSquare;
    messageSquare <== message * message;
}

component main {
    public [
        root,
        subsetRoot,
        nullifier,
        metadata,
        message
    ]
} = WithdrawFromSubsetAssetMetadata(
    20,
    // keccak256("allowed") % p
    11954255677048767585730959529592939615262310191150853775895456173962480955685
);