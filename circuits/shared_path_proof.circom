pragma circom 2.0.0;

include "./common.circom";

/*
    A shared path proof is two inclusion proofs that share an identical path in two same-shape trees with different
    leaves in them. The second tree is an access list that gives permission on a per-index basis, eg to allow a
    withdrawal of commitment i, set the leaf at index i in the subset tree to `expectedValue`.
*/

template SharedPathProof(levels, expectedValue) {
    signal input leaf;
    signal input path;
    signal input mainProof[levels];
    signal input subsetProof[levels];

    signal output root;
    signal output subsetRoot;

    component selectors1[levels];
    component selectors2[levels];

    component hashers1[levels];
    component hashers2[levels];

    component pathBits = Num2Bits(levels);
    pathBits.in <== path;

    for (var i = 0; i < levels; i++) {
        selectors1[i] = DualMux();
        selectors1[i].in[0] <== i == 0 ? leaf : hashers1[i - 1].hash;
        selectors1[i].in[1] <== mainProof[i];
        selectors1[i].s <== pathBits.out[i];

        hashers1[i] = Hash2Nodes();
        hashers1[i].left <== selectors1[i].out[0];
        hashers1[i].right <== selectors1[i].out[1];

        selectors2[i] = DualMux();
        selectors2[i].in[0] <== i == 0 ? expectedValue : hashers2[i - 1].hash;
        selectors2[i].in[1] <== subsetProof[i];
        selectors2[i].s <== pathBits.out[i];

        hashers2[i] = Hash2Nodes();
        hashers2[i].left <== selectors2[i].out[0];
        hashers2[i].right <== selectors2[i].out[1];
    }

    root <== hashers1[levels - 1].hash;
    subsetRoot <== hashers2[levels - 1].hash;
}