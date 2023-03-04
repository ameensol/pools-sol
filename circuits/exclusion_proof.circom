pragma circom 2.0.0;

include "./common.circom";

/*
    We assume the leaves of the exclusion tree are sorted. Therefore, proving that an element is bounded by two
    adjacent leaves in the exclusion tree is proof that an element is not a member of the tree. If it were part
    of the tree, then the leaves wouldn't be adjacent because the element would be between them.

    There's two main cases for an exclusion proof.
    1.) The adjacent leaves are subnodes of the same node in the next layer. This is true when the lower leaf
    has an even index. For this proof, you can use the same merkle proof elements to reconstruct the root.

    2.) The adjacent leaves are subnodes of different nodes in the next layer. This is true when the lower leaf
    has an odd index. For this proof, we need to use two merkle proof element arrays, because they have two different
    branches.

    This exclusion proof treats both cases as case 2, so it always does two merkle proofs. This prevents distinguishing
    between even and odd indexes based on the zkproof (which would cut the anon set into half automatically).
*/

template ExclusionProof(levels) {
    // this leaf is not in the tree
    signal input leaf;

    // lower merkle proof data
    signal input lowerLeaf;
    signal input lowerPath;
    signal input lowerProof[levels];

    // upper merkle proof data. note that we don't have `upperPath`, because it's simply `lowerPath + 1`
    signal input upperLeaf;
    signal input upperProof[levels];

    // the proofs share the same root
    signal output root;

    // constrain lowerLeaf < leaf
    component lowerLeafComparison = LessThan(252);
    lowerLeafComparison.in[0] <== lowerLeaf;
    lowerLeafComparison.in[1] <== leaf;
    lowerLeafComparison.out === 1;

    // constrain leaf < upperLeaf
    component upperLeafComparison = LessThan(252);
    upperLeafComparison.in[0] <== leaf;
    upperLeafComparison.in[1] <== upperLeaf;
    upperLeafComparison.out === 1;

    // get path of lower leaf
    component lowerPathBits = Num2Bits(levels);
    lowerPathBits.in <== lowerPath;

    // the adjacent path of the upper leaf is just the next index over
    component upperPathBits = Num2Bits(levels);
    upperPathBits.in <== lowerPath + 1;

    // selectors decides the order of subnodes before computing a parent node
    component selectors1[levels];
    component selectors2[levels];

    // hashers hashes two subnodes into a parent node
    component hashers1[levels];
    component hashers2[levels];

    for (var i = 0; i < levels; i++) {
        // order the lower proof subnodes
        selectors1[i] = DualMux();
        selectors1[i].in[0] <== i == 0 ? lowerLeaf : hashers1[i - 1].hash;
        selectors1[i].in[1] <== lowerProof[i];
        selectors1[i].s <== lowerPathBits.out[i];

        // compute next lower proof parent node
        hashers1[i] = Hash2Nodes();
        hashers1[i].left <== selectors1[i].out[0];
        hashers1[i].right <== selectors1[i].out[1];

        // order the upper proof subnodes
        selectors2[i] = DualMux();
        selectors2[i].in[0] <== i == 0 ? upperLeaf : hashers2[i - 1].hash;
        selectors2[i].in[1] <== upperProof[i];
        selectors2[i].s <== upperPathBits.out[i];

        // compute next upper proof parent node
        hashers2[i] = Hash2Nodes();
        hashers2[i].left <== selectors2[i].out[0];
        hashers2[i].right <== selectors2[i].out[1];
    }

    // constrain the roots to be equal (the leaves belong to the same tree and are directly adjacent to each other)
    hashers1[levels - 1].hash === hashers2[levels - 1].hash;

    // return root
    root <== hashers1[levels - 1].hash;
}