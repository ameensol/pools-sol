const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    setStorageAt,
    setBalance
} = require("@nomicfoundation/hardhat-network-helpers");
const { poseidonContract } = require("circomlibjs");
const { poseidon, MerkleTree, AccessList, utils } = require("../lib/index");
const { generateProof } = require("../lib/generateProof");
const { verifyProof } = require("../lib/verifyProof");
const {
    deploy,
    deployBytes,
    revertSnapshot,
    setNextBlockTimestamp,
    snapshot
} = require("../scripts/hardhat.utils");

const VERIFIER_JSON = require("../circuits/out/withdraw_from_subset_verifier.json");
const WASM_FNAME =
    "./circuits/out/withdraw_from_subset_js/withdraw_from_subset.wasm";
const ZKEY_FNAME = "./circuits/out/withdraw_from_subset_final.zkey";

const VERBOSE = false;

// ideally choose N_DEPOSITS >= 20
const N_DEPOSITS = 20;
const HACKER_RATIO = 1 / 10;

// two seconds per withdrawal
const WITHDRAWALS_TIMEOUT = N_DEPOSITS * 3000;

function shuffleArray(array) {
    // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// using explicit `function` at this level, instead of an arrow function, gives
// us a persistent state `this` within nested arrow functions in the test
describe("PrivacyTokenPool.sol", function () {
    // we only need to deploy the poseidon contract once, setup params like secrets / commitments
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

        // 1 ETH pool
        this.token = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        this.amount = ethers.utils.parseEther("1");
        this.assetMetadata = utils.hashMod(
            ["address", "uint"],
            [this.token, this.amount]
        );

        // random secrets and commitments
        this.secrets = utils.unsafeRandomLeaves(N_DEPOSITS);
        this.rawCommitments = new Array(N_DEPOSITS);
        this.commitments = new Array(N_DEPOSITS);
        this.secrets.forEach((secret, i) => {
            this.rawCommitments[i] = poseidon([secret]);
            this.commitments[i] = poseidon([
                this.rawCommitments[i],
                this.assetMetadata
            ]);
        });

        // pre-funded accounts (20 total)
        this.signers = await ethers.getSigners();
        const goodSignersEnd = Math.floor(
            (1 - HACKER_RATIO) * this.signers.length
        );

        // not hackers. good guys
        this.goodSigners = this.signers.slice(0, goodSignersEnd);
        // hackers. bad guys
        this.badSigners = this.signers.slice(goodSignersEnd);
        // console.log(this.goodSigners.map(s => s.address), this.badSigners.map(s => s.address), this.signers.map(s => s.address));
        // process.exit();
        // full deposits tree (with all of the commitments in this test)
        this.depositTree = new MerkleTree({
            hasher: poseidon,
            levels: 20,
            baseString: "empty"
        });
        // empty blocklist (this is right-to-left in terms of deposit index)
        this.blocklist = new AccessList({
            treeType: "blocklist",
            subsetString: ""
        });
        this.blocklist.allow(N_DEPOSITS - 1);
        // create fresh recipient addresses and decide random withdrawal order
        this.recipients = new Array(N_DEPOSITS);
        this.withdrawalOrder = new Array(N_DEPOSITS);
        for (let i = 0; i < N_DEPOSITS; i++) {
            this.recipients[i] = ethers.Wallet.createRandom();
            this.withdrawalOrder[i] = i;
        }
        shuffleArray(this.withdrawalOrder);
        // create and fund a relayer address
        this.relayer = ethers.Wallet.createRandom().connect(ethers.provider);
        await setBalance(this.relayer.address, ethers.utils.parseEther("10"));
        // deploy the privacy pool
        this.privacyTokenPool = await deploy(
            "PrivacyTokenPool",
            [this.poseidonContract.address],
            VERBOSE
        );
    });

    // // deploy a new pool and trees each test
    // beforeEach(async () => {
    //     this.privacyTokenPool = await deploy("PrivacyTokenPool", [this.poseidonContract.address], VERBOSE);
    // });

    it(`should deposit ${N_DEPOSITS} times`, async () => {
        // check empty root before any deposits
        expect(
            (await this.privacyTokenPool.getLatestRoot()).toString()
        ).to.be.equal(this.depositTree.root.toString());

        // we'll check that the pool ETH balance increases after each deposit
        var balanceOfPool = ethers.BigNumber.from(0);

        for (let i = 0; i < N_DEPOSITS; i++) {
            // iterate through the signers for depositor variety
            const signer = this.signers[i % this.signers.length];
            // force a specific timestamp (to check against block.timestamp emitted in event)
            const timestamp = Date.now();
            await setNextBlockTimestamp(timestamp);

            const tx = this.privacyTokenPool
                .connect(signer)
                .deposit(this.rawCommitments[i], this.token, this.amount, {
                    value: this.amount
                });
            // deposit using raw commitment, check event log data for commitment
            await expect(tx)
                .to.emit(this.privacyTokenPool, "Deposit")
                .withArgs(
                    this.rawCommitments[i],
                    this.commitments[i],
                    this.token,
                    this.amount,
                    i,
                    timestamp
                );
            // check that the roots match between JS and evm
            await this.depositTree.insert(this.commitments[i]);
            expect(
                (await this.privacyTokenPool.getLatestRoot()).toString()
            ).to.be.equal(this.depositTree.root.toString());

            // check pool has received the ETH
            balanceOfPool = balanceOfPool.add(this.amount);
            expect(
                await ethers.provider.getBalance(this.privacyTokenPool.address)
            ).to.be.equal(balanceOfPool);

            // save snapshot of full deposits
            this.snapshot = await snapshot();
        }
    }).timeout(WITHDRAWALS_TIMEOUT / 2);

    it(`should process ${N_DEPOSITS} withdrawals using the empty block list`, async () => {
        for (const i of this.withdrawalOrder) {
            // withdrawMetadata
            const recipient = this.recipients[i].address;
            const refund = 0;
            const relayer = this.relayer.address;
            const fee = ethers.utils.parseEther("0.001");

            // private inputs
            const secret = this.secrets[i];
            const path = i;
            const { pathElements: mainProof, pathRoot: root } =
                await this.depositTree.path(path);
            const { pathElements: subsetProof, pathRoot: subsetRoot } =
                await this.blocklist.path(path);
            // public inputs
            const nullifier = poseidon([secret, 1, i]);
            const assetMetadata = this.assetMetadata;
            const withdrawMetadata = utils.hashMod(
                ["address", "uint", "address", "uint"],
                [recipient, refund, relayer, fee]
            );

            // generate zkp
            const input = utils.toProofInput({
                root,
                subsetRoot,
                nullifier,
                assetMetadata,
                withdrawMetadata,
                secret,
                path,
                mainProof,
                subsetProof
            });
            const { proof, publicSignals } = await generateProof({
                input,
                wasmFileName: WASM_FNAME,
                zkeyFileName: ZKEY_FNAME
            });

            // verify zkp in js (will get verified in contract too)
            expect(
                await verifyProof({
                    proof,
                    publicSignals,
                    verifierJson: VERIFIER_JSON
                })
            ).to.be.true;

            // checkpoint balances before withdrawal
            const relayerBalanceBefore = await ethers.provider.getBalance(
                relayer
            );
            const poolBalanceBefore = await ethers.provider.getBalance(
                this.privacyTokenPool.address
            );
            const recipientBalanceBefore = await ethers.provider.getBalance(
                recipient
            );

            // submit withdrawal
            const flatProof = utils.flattenProof(proof);
            const tx = this.privacyTokenPool
                .connect(this.relayer)
                .withdrawFromSubset(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    this.token,
                    this.amount,
                    recipient,
                    refund,
                    relayer,
                    fee,
                    { value: refund }
                );
            // check the event emitted with correct data
            await expect(tx)
                .to.emit(this.privacyTokenPool, "Withdrawal")
                .withArgs(recipient, relayer, subsetRoot, nullifier, fee);

            // check relayer balance increased by `fee - txFee`
            const { gasUsed, effectiveGasPrice } = await (await tx).wait();
            expect(await ethers.provider.getBalance(relayer)).to.be.equal(
                relayerBalanceBefore
                    .add(fee)
                    .sub(gasUsed.mul(effectiveGasPrice))
            );
            // check recipient balance increased by `amount - fee`
            expect(await ethers.provider.getBalance(recipient)).to.be.equal(
                recipientBalanceBefore.add(this.amount.sub(fee))
            );
            // check that pool balance decreased by `amount`
            expect(
                await ethers.provider.getBalance(this.privacyTokenPool.address)
            ).to.be.equal(poolBalanceBefore.sub(this.amount));
        }
    }).timeout(WITHDRAWALS_TIMEOUT);

    it("should revert with `MerkleTreeCapacity` when the tree is full", async () => {
        /*
            simulate a full tree by setting the `currentLeafIndex` variable using hardhat
            (it would take too long to compute 1048576 insertions in a hardhat test). the slot was
            found using `hardhat-storage-layout` and running the command `hardhat compile && hardhat check`.
        */
        await setStorageAt(
            this.privacyTokenPool.address,
            1,
            1048576 // 2 ** 20
        );
        await expect(
            this.privacyTokenPool.deposit(1234, this.token, this.amount, {
                value: this.amount
            })
        ).to.be.revertedWithCustomError(
            this.privacyTokenPool,
            "IncrementalMerkleTree__MerkleTreeCapacity"
        );
    });
});
