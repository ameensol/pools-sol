pragma circom 2.0.0;

include "./common.circom";

/*
    An inclusion proof is a simple merkle proof.
*/

template InclusionProof(levels) {
    // this leaf is in the tree
    signal input leaf;

    // merkle proof data
    signal input path;
    signal input proof[levels];

    signal output root;

    // selectors decides the order of subnodes before computing a parent node
    component selectors[levels];

    // hashers hashes two subnodes into a parent node
    component hashers[levels];

    // path is the route of the merkle proof when climbing to the root
    component pathBits = Num2Bits(levels);
    pathBits.in <== path;

    for (var i = 0; i < levels; i++) {
        // order the subnodes before hashing
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== proof[i];
        selectors[i].s <== pathBits.out[i];

        // compute next parent node
        hashers[i] = Hash2Nodes();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    // return the root
    root <== hashers[levels - 1].hash;
}