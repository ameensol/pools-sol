pragma circom 2.0.3;

include "./common.circom";
include "./commitment_universal_nullifier.circom";
include "./inclusion_proof.circom";

template EscapeHatchUniversalNullifier(levels, expectedValue) {
    /*
        Public Inputs
    */
    signal input root; // root of the commitments tree
    signal input nullifier; // prevent double spend: nullifier = poseidon([0, secret, index, path])
    signal input contractCode; // computed as hashMod([contractAddress, chainId]) % p
    signal input message; // arbitrary message data (recipient relayer fee data etc.)

    /*
        Private Inputs
    */
    signal input secret; // preimage of the commitment
    signal input path; // path of the commitment in its tree
    signal input mainProof[levels]; // merkle proof of leaf to recover commitments root

    // compute commitment and nullifier
    component hasher = CommitmentUniversalNullifierHasher();
    hasher.secret <== secret;
    hasher.path <== path;
    hasher.contractCode <== contractCode;
    // constrain public nullifier is rightly derived from secret data
    nullifier === hasher.nullifier;

    // setup both merkle trees with a single template.
    // they share the path, ie the proofs are identical branches in parallel trees
    component tree = InclusionProof(levels);
    tree.leaf <== hasher.commitment;
    tree.path <== path;
    for (var i = 0; i < levels; i++) {
        tree.proof[i] <== proof[i];
    }
    // constraint commitment is member of commitments tree
    root === tree.root;

    // add arbitrary message to zkproof
    signal messageSquare;
    messageSquare <== message * message;
}

component main {
    public [
        root,
        subsetRoot,
        nullifier,
        contractCode,
        message
    ]
} = ExcapeHatchUniversalNullifier(
    20,
    // keccak256("allowed") % p
    11954255677048767585730959529592939615262310191150853775895456173962480955685
);