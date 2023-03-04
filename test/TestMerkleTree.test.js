const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");
const { poseidonContract } = require("circomlibjs");
const { poseidon } = require("../lib/poseidon");
const { MerkleTree } = require("../lib/merkleTree");
const utils = require("../lib/utils");
const { deployBytes } = require("../scripts/hardhat.utils");

const VERBOSE = false;

const FUNCTION_NAMES = [
    // 'testInsertStorage',
    "testInsert"
    // 'testInsertMod',
    // 'testInsertLoop'
    // 'insert',
];

async function insert({
    contract,
    tree,
    element,
    roots,
    functionName,
    verbose
}) {
    // submit insert tx, get gas from receipt
    const tx = await contract[functionName](element);
    const receipt = await tx.wait();
    if (verbose) console.log("insert gas used:", receipt.gasUsed.toString());

    // insert element into js tree, add root to js history
    await tree.insert(element);
    roots.rootIndex = (roots.rootIndex + 1) % 30;
    roots.values[roots.rootIndex] = tree.root;
}

async function update({
    contract,
    tree,
    oldIndex,
    newElement,
    roots,
    functionName,
    verbose
}) {
    // get merkle proof for oldElement
    const element = tree.elements[oldIndex];
    const { pathElements } = tree.path(oldIndex);

    // submit update tx, get gas from receipt
    const tx = await contract[functionName](
        element,
        newElement,
        oldIndex,
        pathElements
    );
    const receipt = await tx.wait();
    if (verbose) console.log("update gas used:", receipt.gasUsed.toString());

    // update element into js tree, change root in js history
    await tree.update(oldIndex, newElement);
    roots.values[roots.rootIndex] = tree.root;
}

// using explicit `function` at this level, instead of an arrow function, gives
// us a persistent state `this` within nested arrow functions in the test
describe("TestMerkleTree.sol - Gas Golfer", function () {
    // we only need to deploy the poseidon contract once
    before(async () => {
        // poseidon hash function evm contract
        const abi = poseidonContract.generateABI(2);
        const bytecode = poseidonContract.createCode(2);
        this.poseidonContract = await deployBytes(
            "Poseidon",
            abi,
            bytecode,
            VERBOSE
        );
        console.log(
            `   Testing ${FUNCTION_NAMES.length} different equivalent functions. Which is the most gas efficient?`
        );
    });

    // deploy a new merkle tree each test
    beforeEach(async () => {
        // deploy merkle tree test contract
        const factory = await ethers.getContractFactory("TestMerkleTree");
        this.merkleTreeContract = await factory.deploy(
            this.poseidonContract.address
        );

        // init off-chain merkle tree
        this.merkleTree = new MerkleTree({
            hasher: poseidon,
            levels: 20,
            baseString: "empty"
        });

        // init off-chain history of roots
        this.roots = {
            rootIndex: 0,
            values: new Array(30).fill(0)
        };
        this.roots.values[0] = this.merkleTree.root;

        // calc random values to insert into the tree. using chunks of 30 so we can check when
        // the root history wraps around
        this.leaves = utils.unsafeRandomLeaves(60);
    });

    it("should successfully perform update operations", async () => {
        for (let i = 0; i < 20; i++) {
            // insert leaves to start with
            await insert({
                contract: this.merkleTreeContract,
                functionName: "testInsert",
                tree: this.merkleTree,
                roots: this.roots,
                element: this.leaves[i],
                verbose: VERBOSE
            });
            // check that the roots match
            expect(
                (await this.merkleTreeContract.getLatestRoot()).toString()
            ).to.be.equal(this.merkleTree.root.toString());
        }

        for (let i = 0; i < 20; i++) {
            // update all of the leaves
            await update({
                contract: this.merkleTreeContract,
                functionName: "testUpdate",
                tree: this.merkleTree,
                roots: this.roots,
                oldIndex: i,
                newElement: (i + 1) * 420,
                verbose: VERBOSE
            });
            // check that the roots match
            expect(
                (await this.merkleTreeContract.getLatestRoot()).toString()
            ).to.be.equal(this.merkleTree.root.toString());
        }

        // compare with a tree that had those leaves inserted rather than updated
        const rawTree = new MerkleTree({
            hasher: poseidon,
            levels: 20,
            baseString: "empty"
        });
        for (let i = 0; i < 20; i++) {
            await rawTree.insert((i + 1) * 420);
        }
        // check that the contract root is the same
        expect(
            (await this.merkleTreeContract.getLatestRoot()).toString()
        ).to.be.equal(rawTree.root.toString());
    });

    for (const functionName of FUNCTION_NAMES) {
        describe(`${functionName}`, () => {
            it("should have the zero root", async () => {
                // check the initial root (the zero root)
                expect(
                    (await this.merkleTreeContract.getLatestRoot()).toString()
                ).to.be.equal(this.merkleTree.root.toString());
            });

            it("should revert with `MerkleTreeCapacity` when the tree is full", async () => {
                /*
                    simulate a full tree by setting the `currentLeafIndex` variable using hardhat
                    (it would take too long to compute 1048576 insertions in a hardhat test). the slot was
                    found using `hardhat-storage-layout` and running the command `yarn hardhat check`.
                */
                await setStorageAt(
                    this.merkleTreeContract.address,
                    2,
                    1048576 // 2 ** 20
                );
                await expect(
                    this.merkleTreeContract.testInsert(42)
                ).to.be.revertedWithCustomError(
                    this.merkleTreeContract,
                    "MerkleTreeCapacity"
                );
            });

            it("should correctly compute the next root after one insertion", async () => {
                // insert one leaf
                await insert({
                    contract: this.merkleTreeContract,
                    functionName,
                    tree: this.merkleTree,
                    roots: this.roots,
                    element: this.leaves[0],
                    verbose: VERBOSE
                });
                // check the second root
                expect(
                    (await this.merkleTreeContract.getLatestRoot()).toString()
                ).to.be.equal(this.merkleTree.root.toString());
            });

            it("should correctly compute the next 30 new roots", async () => {
                // do first 29 insert (this gives us a full first 30 roots because of the zero root)
                for (const element of this.leaves.slice(0, 29)) {
                    await insert({
                        contract: this.merkleTreeContract,
                        functionName,
                        tree: this.merkleTree,
                        roots: this.roots,
                        element,
                        verbose: VERBOSE
                    });
                    expect(
                        (
                            await this.merkleTreeContract.getLatestRoot()
                        ).toString()
                    ).to.be.equal(this.merkleTree.root.toString());
                }

                // should remember the first thirty roots (max capacity of roots history)
                for (const root of this.roots.values) {
                    expect(await this.merkleTreeContract.isKnownRoot(root)).to
                        .be.true;
                }

                // do 30th insert, clearing the first root from the history (the zero root)
                const nextToForget = this.roots.values[0];
                expect(await this.merkleTreeContract.isKnownRoot(nextToForget))
                    .to.be.true;
                await insert({
                    contract: this.merkleTreeContract,
                    functionName,
                    tree: this.merkleTree,
                    roots: this.roots,
                    element: this.leaves[29],
                    verbose: VERBOSE
                });
                expect(
                    (await this.merkleTreeContract.getLatestRoot()).toString()
                ).to.be.equal(this.merkleTree.root.toString());

                // should have overwritten original root now
                expect(await this.merkleTreeContract.isKnownRoot(nextToForget))
                    .to.be.false;
            }).timeout(100000);

            it("should correctly compute 60 new roots and forget the first thirty", async () => {
                // return to previous test state
                for (const element of this.leaves.slice(0, 29)) {
                    await insert({
                        contract: this.merkleTreeContract,
                        functionName,
                        tree: this.merkleTree,
                        roots: this.roots,
                        element,
                        verbose: VERBOSE
                    });
                }
                // snapshot of first 30 roots
                const firstThirtyRoots = [...this.roots.values];
                // return to last test's state (we already checked that the first root erased)
                await insert({
                    contract: this.merkleTreeContract,
                    functionName,
                    tree: this.merkleTree,
                    roots: this.roots,
                    element: this.leaves[29],
                    verbose: VERBOSE
                });

                // repeat the test but with another 30 leaves. again do 29 inserts first
                for (const element of this.leaves.slice(30, 59)) {
                    await insert({
                        contract: this.merkleTreeContract,
                        functionName,
                        tree: this.merkleTree,
                        roots: this.roots,
                        element,
                        verbose: VERBOSE
                    });
                    expect(
                        (
                            await this.merkleTreeContract.getLatestRoot()
                        ).toString()
                    ).to.be.equal(this.merkleTree.root.toString());
                }

                // should remember current roots
                for (const root of this.roots.values) {
                    expect(await this.merkleTreeContract.isKnownRoot(root)).to
                        .be.true;
                }

                // by now we've forgotten all of the original roots
                for (const root of firstThirtyRoots) {
                    expect(await this.merkleTreeContract.isKnownRoot(root)).to
                        .be.false;
                }

                // final insert of 60 total. check that the roots index resets again
                const nextToForget = this.roots.values[0];
                expect(await this.merkleTreeContract.isKnownRoot(nextToForget))
                    .to.be.true;
                await insert({
                    contract: this.merkleTreeContract,
                    functionName,
                    tree: this.merkleTree,
                    roots: this.roots,
                    element: this.leaves[59],
                    verbose: VERBOSE
                });
                expect(
                    (await this.merkleTreeContract.getLatestRoot()).toString()
                ).to.be.equal(this.merkleTree.root.toString());

                expect(await this.merkleTreeContract.isKnownRoot(nextToForget))
                    .to.be.false;
            });
        });
    }
});
