const fs = require("fs");
const { poseidonContract } = require("circomlibjs");
const { ethers } = require("hardhat");
const { deploy, deployBytes } = require("./hardhat.utils.js");
const poseidonContracts = require("../poseidonContracts.json");

const denominations = [
    ethers.utils.parseEther("0.01"),
    ethers.utils.parseEther("0.001"),
];

async function main() {
    hre.ethers.provider.getNetwork().then(async ({ chainId }) => {
        const poseidonAddress = poseidonContracts[chainId];
        if (!poseidonAddress) {
            const abi = poseidonContract.generateABI(2);
            const bytecode = poseidonContract.createCode(2);
            const poseidon = await deployBytes("Poseidon", abi, bytecode, true);
            poseidonContracts[chainId] = poseidon.address;
            fs.writeFileSync(
                "./poseidonContracts.json",
                JSON.stringify(poseidonContracts, null, 4)
            );
        }

        for (const denomination of denominations) {
            await deploy(
                "PrivacyPool",
                [poseidonContracts[chainId], denomination],
                true
            );
        }
    });
}

main().catch(console.error);
