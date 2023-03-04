const { AccessList } = require("./accessList");
const { MerkleTree } = require("./merkleTree");
const { NoteWallet } = require("./noteWallet");
const { NoteWalletV2 } = require("./noteWalletV2");
const { createSubsetFromFilter } = require("./createSubsetFromFilter");
const { generateProof } = require("./generateProof");
const { poseidon } = require("./poseidon");
const { subsetRootToSubsetString } = require("./subsetRootToSubsetString");
const { subsetStringToSubsetRoot } = require("./subsetStringToSubsetRoot");
const utils = require("./utils");
const { verifyProof } = require("./verifyProof");
const subsets = require("./subsets");

Object.assign(module.exports, {
    AccessList,
    MerkleTree,
    NoteWallet,
    NoteWalletV2,
    createSubsetFromFilter,
    generateProof,
    poseidon,
    subsetRootToSubsetString,
    subsetStringToSubsetRoot,
    verifyProof,
    subsets,
    utils
});
