const { MerkleTree } = require("fixed-merkle-tree");
const { getZero } = require("./utils");

Object.assign(module.exports, {
    MerkleTree: class extends MerkleTree {
        constructor({
            hasher,
            levels = 20,
            leaves = [],
            baseString = "empty",
            zeroValue
        }) {
            let zeroElement;
            if (typeof zeroValue !== "undefined") {
                zeroElement = zeroValue;
            } else {
                zeroElement = getZero(baseString);
            }
            super(levels, leaves, {
                hashFunction: (left, right) => hasher([left, right]),
                zeroElement
            });
        }
    }
});
