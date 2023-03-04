const { BitSet } = require("bitset");
const { poseidon: hasher } = require("./poseidon");
const { MerkleTree } = require("./merkleTree");
const { ALLOWED, BLOCKED, zeroArray } = require("./utils");

class AccessList extends MerkleTree {
    constructor({ treeType, subsetString }) {
        let zeroElement, oneElement;
        switch (treeType) {
            case "allowlist":
                [zeroElement, oneElement] = [BLOCKED, ALLOWED];
                break;
            case "blocklist":
                [zeroElement, oneElement] = [ALLOWED, BLOCKED];
                break;
            default:
                throw new Error(
                    `Invalid treeType: ${treeType}. Use "allowlist" or "blocklist".`
                );
        }

        if (!/^[01]*$/.test(subsetString)) {
            throw new Error(
                `Invalid subsetString: ${subsetString}. Use a binary string only.`
            );
        }

        let leaves, subset;
        if (subsetString.length === 0) {
            subset = new BitSet();
            leaves = new Array();
        } else {
            subset = new BitSet(subsetString);
            leaves = subsetString.split("");
            const numLeaves = leaves.length;
            for (let i = 0; i < numLeaves; i++) {
                leaves[i] = subset.get(i) === 0 ? zeroElement : oneElement;
            }
        }

        super({ hasher, leaves, zeroValue: zeroElement });
        this.oneElement = oneElement;
        this.subset = subset;
        this.treeType = treeType;
    }

    resizeTreeIfNecessary(index) {
        if (typeof index !== "number" || index < 0 || index >= this.capacity) {
            throw new Error(
                `Invalid index: ${index}. Use an index in the range of the tree capacity.`
            );
        }
        const numLeaves = this.elements.length;
        if (numLeaves < index + 1) {
            try {
                this.bulkInsert(
                    zeroArray(index + 1 - numLeaves, this.zeroElement)
                );
            } catch (err) {
                console.error(err);
                throw new Error(`Error resizing the tree: ${err}`);
            }
        }
    }

    setBit(index, bit) {
        if (typeof bit !== "number" || (bit !== 0 && bit !== 1)) {
            throw new Error(`Invalid bit ${bit}, Use 0 or 1 only.`);
        }
        this.resizeTreeIfNecessary(index);
        try {
            this.subset.set(index, bit);
            this.update(index, bit === 0 ? this.zeroElement : this.oneElement);
        } catch (err) {
            throw new Error(`Error updating the tree: ${err}`);
        }
    }

    allow(index) {
        switch (this.treeType) {
            case "allowlist":
                this.setBit(index, 1);
                break;
            case "blocklist":
                this.setBit(index, 0);
                break;
            default:
                throw new Error(`Error: treeType not specified`);
        }
    }

    block(index) {
        switch (this.treeType) {
            case "allowlist":
                this.setBit(index, 0);
                break;
            case "blocklist":
                this.setBit(index, 1);
                break;
            default:
                throw new Error(`Error: treeType not specified`);
        }
    }
}

Object.assign(module.exports, { AccessList });
