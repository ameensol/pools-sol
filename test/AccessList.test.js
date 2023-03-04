const { expect } = require("chai");
const { poseidon } = require("../lib/poseidon");
const { AccessList } = require("../lib/accessList");
const { MerkleTree } = require("../lib/merkleTree");
const { ALLOWED, BLOCKED, randomFEs } = require("../lib/utils");

// N * 31 * 8 determines how many members in the set. raise with caution
const N = 3;

describe("AccessList.js", function () {
    before(async () => {
        // This gives us a random subsetString every test. Each random field element is 31 bytes.
        // The subsetString is just N random field elements concatenated into a bytestring.
        // This corresponds to a list with N * 31 * 8 deposits. It's literally an incomprehensible list.
        const randomBytes = randomFEs(N);
        let subsetString = "";
        for (const bytes of randomBytes) {
            subsetString = subsetString.concat(bytes.toString(2));
        }
        this.subsetString = subsetString;
    });

    describe("throw cases", () => {
        it("should throw when the treeType is invalid", async () => {
            let treeType;
            let errMsg = () =>
                `Invalid treeType: ${treeType}. Use "allowlist" or "blocklist".`;

            // `expect(func).to.throw(errMsg)` invokes func() with no arguments, but
            // we're testing a class constructor so wrap it in a func
            const newAllowList = () =>
                new AccessList({ hasher: poseidon, treeType });
            const newBlockList = () =>
                new AccessList({ hasher: poseidon, treeType });

            // test when treeType is undefined
            expect(newAllowList).to.throw(errMsg());
            expect(newBlockList).to.throw(errMsg());

            // test when treeType is other values
            treeType = "asdf";
            expect(newAllowList).to.throw(errMsg());
            expect(newBlockList).to.throw(errMsg());
            treeType = "allow_list";
            expect(newAllowList).to.throw(errMsg());
            expect(newBlockList).to.throw(errMsg());
        });

        it("should throw on invalid subsetString", async () => {
            let subsetString;
            const errMsg = () =>
                `Invalid subsetString: ${subsetString}. Use a binary string only.`;

            const newAllowList = () =>
                new AccessList({ treeType: "allowlist", subsetString });
            const newBlockList = () =>
                new AccessList({ treeType: "blocklist", subsetString });

            // test when subsetString is undefined
            expect(newAllowList).to.throw(errMsg());
            expect(newBlockList).to.throw(errMsg());

            // test when subsetString is a valid `BitSet` constructor but not binary (non-exhaustive tests)
            subsetString = "0xef";
            expect(newAllowList).to.throw(errMsg());
            expect(newBlockList).to.throw(errMsg());
            subsetString = [0, 1];
            expect(newAllowList).to.throw(errMsg());
            expect(newBlockList).to.throw(errMsg());
        });
    });

    it("allowlist tree root should be correct", async () => {
        this.allowlist = new AccessList({
            treeType: "allowlist",
            subsetString: this.subsetString
        });

        // when using the subset bit string, we need to go in reverse order because
        // the BitSet library stores bits right-to-left
        // furthermore, the bitset library trims trailing zeros so we use the subsetString
        // because it has the entire length of the subset
        let allowlistLeaves = [];
        for (let i = this.subsetString.length - 1; i >= 0; i--) {
            allowlistLeaves.push(this.subsetString[i] == 0 ? BLOCKED : ALLOWED);
        }

        this.allowlistTree = new MerkleTree({
            hasher: poseidon,
            baseString: "blocked",
            leaves: allowlistLeaves
        });
        expect(this.allowlist.root).to.be.equal(this.allowlistTree.root);
    });

    it("blocklist tree root should be correct", async () => {
        this.blocklist = new AccessList({
            hasher: poseidon,
            levels: 20,
            treeType: "blocklist",
            subsetString: this.subsetString
        });

        let blocklistLeaves = [];
        for (let i = this.subsetString.length - 1; i >= 0; i--) {
            blocklistLeaves.push(this.subsetString[i] == 0 ? ALLOWED : BLOCKED);
        }

        this.blocklistTree = new MerkleTree({
            hasher: poseidon,
            baseString: "allowed",
            leaves: blocklistLeaves
        });
        expect(this.blocklist.root).to.be.equal(this.blocklistTree.root);
    });

    it("should extend the tree when setting a bit outside of the index", async () => {
        const allowlist = new AccessList({
            treeType: "allowlist",
            subsetString: ""
        });
        expect(allowlist.elements.length).to.be.equal(0);
        allowlist.block(342);
        expect(allowlist.elements.length).to.be.equal(343);

        const blocklist = new AccessList({
            treeType: "blocklist",
            subsetString: ""
        });
        expect(blocklist.elements.length).to.be.equal(0);
        blocklist.block(215);
        expect(blocklist.elements.length).to.be.equal(216);
    });
});
