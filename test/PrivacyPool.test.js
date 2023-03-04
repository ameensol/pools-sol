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

const VERIFIER_JSON = require("../circuits/out/withdraw_from_subset_simple_verifier.json");
const WASM_FNAME =
    "./circuits/out/withdraw_from_subset_simple_js/withdraw_from_subset_simple.wasm";
const ZKEY_FNAME = "./circuits/out/withdraw_from_subset_simple_final.zkey";

const VERBOSE = false;

// ideally choose N_DEPOSITS >= 20
const N_DEPOSITS = 20;
const HACKER_RATIO = 1 / 4;

// 3 seconds per withdrawal
const WITHDRAWALS_TIMEOUT = N_DEPOSITS * 3000;

function shuffleArray(array) {
    // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function padLeft(value) {
    return ethers.utils.hexZeroPad(value, 32);
}

// using explicit `function` at this level, instead of an arrow function, gives
// us a persistent state `this` within nested arrow functions in the test
describe("PrivacyPool.sol", function () {
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
        this.denomination = ethers.utils.parseEther("1");

        // random secrets and commitments
        this.secrets = utils.randomFEs(N_DEPOSITS);
        this.commitments = this.secrets.map((secret) => poseidon([secret]));

        // pre-funded accounts (20 total)
        this.signers = await ethers.getSigners();
        const goodSignersEnd = Math.floor(
            (1 - HACKER_RATIO) * this.signers.length
        );

        // not hackers. good guys
        this.goodSigners = this.signers.slice(0, goodSignersEnd);
        // hackers. bad guys
        this.badSigners = this.signers.slice(goodSignersEnd);
        // what will be the full deposits tree (with all of the commitments in this test)
        this.depositTree = new MerkleTree({
            hasher: poseidon,
            levels: 20,
            baseString: "empty"
        });
        // empty blocklist
        this.emptyBlocklist = new AccessList({
            treeType: "blocklist",
            subsetString: ""
        });
        this.emptyBlocklist.allow(N_DEPOSITS - 1);
        // hacker blocklist
        this.hackerBlocklist = new AccessList({
            treeType: "blocklist",
            subsetString: ""
        });
        // will get updated during deposits to block the bad signers
        this.hackerBlocklist.allow(N_DEPOSITS - 1);
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
        this.privacyPool = await deploy(
            "PrivacyPool",
            [this.poseidonContract.address, this.denomination],
            VERBOSE
        );
    });

    beforeEach(async () => {
        if (typeof this.fullSnapshot !== "undefined") {
            // revert to full deposits snapshot
            await revertSnapshot(this.fullSnapshot);
            // save it again (it gets deleted upon revert)
            this.fullSnapshot = await snapshot();
        }
    });

    describe("success cases", () => {
        it(`should deposit ${N_DEPOSITS} times`, async () => {
            // check empty root before any deposits
            expect(
                (await this.privacyPool.getLatestRoot()).toString()
            ).to.be.equal(padLeft(this.depositTree.root));

            // we'll check that the pool ETH balance increases after each deposit
            var balanceOfPool = ethers.BigNumber.from(0);

            for (let i = 0; i < N_DEPOSITS; i++) {
                const signerIndex = i % this.signers.length;
                if (signerIndex >= this.goodSigners.length) {
                    this.hackerBlocklist.block(i);
                }
                // iterate through the signers for depositor variety
                const signer = this.signers[signerIndex];
                // force a specific timestamp (to check against block.timestamp emitted in event)
                const timestamp = Date.now();
                await setNextBlockTimestamp(timestamp);

                const tx = this.privacyPool
                    .connect(signer)
                    .deposit(padLeft(this.commitments[i]), {
                        value: this.denomination
                    });
                // deposit using commitment, check event log data for commitment
                await expect(tx)
                    .to.emit(this.privacyPool, "Deposit")
                    .withArgs(
                        padLeft(this.commitments[i]),
                        this.denomination,
                        i,
                        timestamp
                    );
                // check that the roots match between JS and evm
                await this.depositTree.insert(this.commitments[i]);
                expect(
                    (await this.privacyPool.getLatestRoot()).toString()
                ).to.be.equal(padLeft(this.depositTree.root));

                // check pool has received the ETH
                balanceOfPool = balanceOfPool.add(this.denomination);
                expect(
                    await ethers.provider.getBalance(this.privacyPool.address)
                ).to.be.equal(balanceOfPool);
            }
            // save snapshot of full deposits
            this.fullSnapshot = await snapshot();
        }).timeout(WITHDRAWALS_TIMEOUT / 2);

        describe("withdrawals with empty blocklist -- everyone can always withdraw", () => {
            it(`should process ${N_DEPOSITS} withdrawals using the empty block list`, async () => {
                for (const i of this.withdrawalOrder) {
                    // message data
                    const recipient = this.recipients[i].address;
                    const relayer = this.relayer.address;
                    const fee = ethers.utils.parseEther("0.001");

                    // private inputs
                    const secret = this.secrets[i];
                    const path = i;
                    const { pathElements: mainProof, pathRoot: root } =
                        this.depositTree.path(path);
                    const { pathElements: subsetProof, pathRoot: subsetRoot } =
                        this.emptyBlocklist.path(path);
                    // public inputs
                    const nullifier = poseidon([secret, 1, i]);
                    const message = utils.hashMod(
                        ["address", "address", "uint"],
                        [recipient, relayer, fee]
                    );

                    // generate zkp
                    const input = utils.toProofInput({
                        root,
                        subsetRoot,
                        nullifier,
                        message,
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
                    const relayerBalanceBefore =
                        await ethers.provider.getBalance(relayer);
                    const poolBalanceBefore = await ethers.provider.getBalance(
                        this.privacyPool.address
                    );
                    const recipientBalanceBefore =
                        await ethers.provider.getBalance(recipient);

                    const flatProof = utils.flattenProof(proof);
                    // store the calldata of a valid withdrawal for testing revert cases later
                    if (typeof this.zkpCalldata === "undefined")
                        this.zkpCalldata = [
                            flatProof,
                            padLeft(root),
                            padLeft(subsetRoot),
                            padLeft(nullifier),
                            recipient,
                            relayer,
                            fee
                        ];

                    // submit withdrawal
                    const tx = this.privacyPool
                        .connect(this.relayer)
                        .withdraw(
                            flatProof,
                            padLeft(root),
                            padLeft(subsetRoot),
                            padLeft(nullifier),
                            recipient,
                            relayer,
                            fee
                        );
                    // check the event emitted with correct data
                    await expect(tx)
                        .to.emit(this.privacyPool, "Withdrawal")
                        .withArgs(
                            recipient,
                            relayer,
                            padLeft(subsetRoot),
                            padLeft(nullifier),
                            fee
                        );

                    // check relayer balance increased by `fee - txFee`
                    const { gasUsed, effectiveGasPrice } = await (
                        await tx
                    ).wait();
                    expect(
                        await ethers.provider.getBalance(relayer)
                    ).to.be.equal(
                        relayerBalanceBefore
                            .add(fee)
                            .sub(gasUsed.mul(effectiveGasPrice))
                    );
                    // check recipient balance increased by `amount - fee`
                    expect(
                        await ethers.provider.getBalance(recipient)
                    ).to.be.equal(
                        recipientBalanceBefore.add(this.denomination.sub(fee))
                    );
                    // check that pool balance decreased by `amount`
                    expect(
                        await ethers.provider.getBalance(
                            this.privacyPool.address
                        )
                    ).to.be.equal(poolBalanceBefore.sub(this.denomination));
                }
            }).timeout(WITHDRAWALS_TIMEOUT);
        });

        describe("withdrawals with hacker-filled blocklist; good signers can use it; bad signers can't", () => {
            it(`should process good withdrawals using the hacker block list`, async () => {
                for (const i of this.withdrawalOrder) {
                    // we're still doing random order, just skipping the bad signers
                    if (i >= this.goodSigners.length) continue;

                    // message data
                    const recipient = this.recipients[i].address;
                    const relayer = this.relayer.address;
                    const fee = ethers.utils.parseEther("0.001");

                    // private inputs
                    const secret = this.secrets[i];
                    const path = i;
                    const { pathElements: mainProof, pathRoot: root } =
                        this.depositTree.path(path);
                    const { pathElements: subsetProof, pathRoot: subsetRoot } =
                        this.hackerBlocklist.path(path);
                    // public inputs
                    const nullifier = poseidon([secret, 1, i]);
                    const message = utils.hashMod(
                        ["address", "address", "uint"],
                        [recipient, relayer, fee]
                    );

                    // generate zkp
                    const input = utils.toProofInput({
                        root,
                        subsetRoot,
                        nullifier,
                        message,
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
                    const relayerBalanceBefore =
                        await ethers.provider.getBalance(relayer);
                    const poolBalanceBefore = await ethers.provider.getBalance(
                        this.privacyPool.address
                    );
                    const recipientBalanceBefore =
                        await ethers.provider.getBalance(recipient);

                    const flatProof = utils.flattenProof(proof);
                    // store the calldata of a valid withdrawal for testing revert cases later
                    if (typeof this.zkpCalldata === "undefined")
                        this.zkpCalldata = [
                            flatProof,
                            padLeft(root),
                            padLeft(subsetRoot),
                            padLeft(nullifier),
                            recipient,
                            relayer,
                            fee
                        ];

                    // submit withdrawal
                    const tx = this.privacyPool
                        .connect(this.relayer)
                        .withdraw(
                            flatProof,
                            padLeft(root),
                            padLeft(subsetRoot),
                            padLeft(nullifier),
                            recipient,
                            relayer,
                            fee
                        );
                    // check the event emitted with correct data
                    await expect(tx)
                        .to.emit(this.privacyPool, "Withdrawal")
                        .withArgs(
                            recipient,
                            relayer,
                            padLeft(subsetRoot),
                            padLeft(nullifier),
                            fee
                        );

                    // check relayer balance increased by `fee - txFee`
                    const { gasUsed, effectiveGasPrice } = await (
                        await tx
                    ).wait();
                    expect(
                        await ethers.provider.getBalance(relayer)
                    ).to.be.equal(
                        relayerBalanceBefore
                            .add(fee)
                            .sub(gasUsed.mul(effectiveGasPrice))
                    );
                    // check recipient balance increased by `amount - fee`
                    expect(
                        await ethers.provider.getBalance(recipient)
                    ).to.be.equal(
                        recipientBalanceBefore.add(this.denomination.sub(fee))
                    );
                    // check that pool balance decreased by `amount`
                    expect(
                        await ethers.provider.getBalance(
                            this.privacyPool.address
                        )
                    ).to.be.equal(poolBalanceBefore.sub(this.denomination));
                }
            }).timeout(WITHDRAWALS_TIMEOUT);

            it(`should prevent bad withdrawals from using the hacker block list`, async () => {
                for (const i of this.withdrawalOrder) {
                    // we're still doing random order, just skipping the bad signers
                    if (i < this.goodSigners.length) continue;

                    // message data
                    const recipient = this.recipients[i].address;
                    const relayer = this.relayer.address;
                    const fee = ethers.utils.parseEther("0.001");

                    // private inputs
                    const secret = this.secrets[i];
                    const path = i;
                    const { pathElements: mainProof, pathRoot: root } =
                        this.depositTree.path(path);
                    const { pathElements: subsetProof, pathRoot: subsetRoot } =
                        this.hackerBlocklist.path(path);
                    // public inputs
                    const nullifier = poseidon([secret, 1, i]);
                    const message = utils.hashMod(
                        ["address", "address", "uint"],
                        [recipient, relayer, fee]
                    );

                    const input = utils.toProofInput({
                        root,
                        subsetRoot,
                        nullifier,
                        message,
                        secret,
                        path,
                        mainProof,
                        subsetProof
                    });

                    let proofError = false;
                    try {
                        await generateProof({
                            input,
                            wasmFileName: WASM_FNAME,
                            zkeyFileName: ZKEY_FNAME
                        });
                    } catch (err) {
                        // I couldn't get expect(...).to.throw() to work, probably
                        // because the error is an assertion happening in wasm?
                        // error src:
                        // https://github.com/iden3/circom_runtime/blob/master/js/witness_calculator.js#L72-L82
                        proofError = true;
                    }
                    expect(proofError).to.be.true;
                }
            }).timeout(WITHDRAWALS_TIMEOUT);
        });
    });

    describe("revert cases", () => {
        it("should revert with `ReentrancyGuard: reentrant call`", async () => {
            // testing: recipient reentrancy attack
            // testing: relayer reentrancy attack
            const reentrancyAttacker = await deploy(
                "ReentrancyAttacker",
                [],
                VERBOSE
            );
            const fee = ethers.utils.parseEther("0.001");

            // private inputs
            const secret = this.secrets[0];
            const path = 0;
            const { pathElements: mainProof, pathRoot: root } =
                this.depositTree.path(path);
            const { pathElements: subsetProof, pathRoot: subsetRoot } =
                this.hackerBlocklist.path(path);

            // public inputs
            const nullifier = poseidon([secret, 1, path]);

            let recipient, relayer;
            for (const s of [0, 1]) {
                if (s === 0) {
                    recipient = reentrancyAttacker.address;
                    relayer = this.relayer.address;
                } else {
                    recipient = this.relayer.address;
                    relayer = reentrancyAttacker.address;
                }
                const message = utils.hashMod(
                    ["address", "address", "uint"],
                    [recipient, relayer, fee]
                );

                // generate zkp
                const input = utils.toProofInput({
                    root,
                    subsetRoot,
                    nullifier,
                    message,
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

                const flatProof = utils.flattenProof(proof);
                await expect(
                    this.privacyPool.withdraw(
                        flatProof,
                        padLeft(root),
                        padLeft(subsetRoot),
                        padLeft(nullifier),
                        recipient,
                        relayer,
                        fee
                    )
                ).to.be.revertedWith("ReentrancyGuard: reentrant call");
            }
        });

        it("should revert with `PrivacyPool__FeeExceedsDenomination()`", async () => {
            // testing: fee > denomination

            // this calldata is a valid withdrawal, we're gonna manipulate some of the values
            // for the following revert tests
            const [
                flatProof,
                root,
                subsetRoot,
                nullifier,
                recipient,
                relayer,
                fee
            ] = this.zkpCalldata;
            // set fee to denomination + 1 wei
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    recipient,
                    relayer,
                    ethers.utils.parseEther("1.000000000000000001")
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__FeeExceedsDenomination"
            );
        });

        it("should revert with `PrivacyPool__InvalidZKProof()`", async () => {
            // testing: relayer tries to change recipient (steal funds)
            // testing: relayer tries to increase fee (steal funds)
            // testing: relayer tries to change relayer (associates user with unknown relayer entity)
            const [
                flatProof,
                root,
                subsetRoot,
                nullifier,
                recipient,
                relayer,
                fee
            ] = this.zkpCalldata;

            // set recipient to relayer address
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    relayer,
                    relayer,
                    fee
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__InvalidZKProof"
            );

            // set fee 1 wei less than denomination
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    recipient,
                    relayer,
                    ethers.utils.parseEther("0.999999999999999999")
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__InvalidZKProof"
            );

            // change relayer to a different address
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    recipient,
                    ethers.Wallet.createRandom().address,
                    fee
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__InvalidZKProof"
            );
        });

        it("should revert with `PrivacyPool__MsgValueInvalid()`", async () => {
            // try to deposit without sending any eth
            await expect(
                this.privacyPool.deposit(padLeft("0x123456789"))
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__MsgValueInvalid"
            );

            // try to deposit by sending less than denomination eth
            await expect(this.privacyPool.deposit(padLeft("0x123456789")), {
                value: ethers.utils.parseEther("0.1")
            }).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__MsgValueInvalid"
            );
        });

        it("should revert with `PrivacyPool__UnknownRoot()`", async () => {
            // try to withdraw by constructing a proof in an invalid tree
            // we're going to update a leaf and try to withdraw using that tree
            const secret = utils.randomFEs(1)[0];
            const fakeCommitment = poseidon([secret]);

            const recipient = ethers.Wallet.createRandom().address;
            const relayer = this.relayer.address;
            const fee = ethers.utils.parseEther("0.001");

            // try to spoof the 17th deposit
            const path = 16;
            this.depositTree.update(path, fakeCommitment);
            const { pathElements: mainProof, pathRoot: root } =
                this.depositTree.path(path);
            const { pathElements: subsetProof, pathRoot: subsetRoot } =
                this.emptyBlocklist.path(path);

            // restore the tree to its valid state after the proof gets computed
            this.depositTree.update(path, this.commitments[path]);

            // public inputs
            const nullifier = poseidon([secret, 1, path]);
            const message = utils.hashMod(
                ["address", "address", "uint"],
                [recipient, relayer, fee]
            );

            // generate zkp
            const input = utils.toProofInput({
                root,
                subsetRoot,
                nullifier,
                message,
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

            // verify zkp in js
            // there's nothing wrong with the math for the zkp.
            // it's just that the tree doesn't match the contract
            expect(
                await verifyProof({
                    proof,
                    publicSignals,
                    verifierJson: VERIFIER_JSON
                })
            ).to.be.true;

            const flatProof = utils.flattenProof(proof);
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    padLeft(root),
                    padLeft(subsetRoot),
                    padLeft(nullifier),
                    recipient,
                    relayer,
                    fee
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__UnknownRoot"
            );
        });

        it("should revert with `PrivacyPool__ZeroAddress()`", async () => {
            const [
                flatProof,
                root,
                subsetRoot,
                nullifier,
                recipient,
                relayer,
                fee
            ] = this.zkpCalldata;

            // check that recipient == zero address fails
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    ethers.constants.AddressZero,
                    relayer,
                    fee
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__ZeroAddress"
            );

            // check that relayer == zero address fails
            await expect(
                this.privacyPool.withdraw(
                    flatProof,
                    root,
                    subsetRoot,
                    nullifier,
                    recipient,
                    ethers.constants.AddressZero,
                    fee
                )
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__ZeroAddress"
            );
        });

        it("should revert with `PrivacyPool__NoteAlreadySpent()`", async () => {
            // valid withdraw using the nullifier (this spends the note)
            await this.privacyPool.withdraw(...this.zkpCalldata);

            // try to double spend by submitting the same withdrawal again
            await expect(
                this.privacyPool.withdraw(...this.zkpCalldata)
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "PrivacyPool__NoteAlreadySpent"
            );
        });

        it("should revert with `IncrementalMerkleTree__MerkleTreeCapacity`", async () => {
            /*
                simulate a full tree by setting the `currentLeafIndex` variable using hardhat
                (it would take too long to compute 1048576 insertions in a hardhat test). the slot was
                found using `hardhat-storage-layout` and running the command `hardhat compile && hardhat check`.
            */
            await setStorageAt(
                this.privacyPool.address,
                1,
                1048576 // 2 ** 20
            );
            await expect(
                this.privacyPool.deposit(padLeft("0x1234"), {
                    value: this.denomination
                })
            ).to.be.revertedWithCustomError(
                this.privacyPool,
                "IncrementalMerkleTree__MerkleTreeCapacity"
            );
        });
    });
});
