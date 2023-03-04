require('dotenv').config();
const fs = require("fs");
const { poseidonContract } = require("circomlibjs");
const { ethers } = require("hardhat");
const { deploy, deployBytes } = require("./hardhat.utils.js");
const poseidonContracts = require("../poseidonContracts.json");
const { NoteWalletV2 } = require('../lib/noteWalletV2.js');
const PrivacyPoolAbi = require('../build/artifacts/contracts/PrivacyPool.sol/PrivacyPool.json').abi

const denominations = [
  ethers.utils.parseEther("0.01"),
  ethers.utils.parseEther("0.001"),
];

const { NOTE_WALLET_MNEMONIC } = process.env

const NUM_INITIAL_DEPOSITS = 3

async function main() {
    const gasPrice = ethers.utils.parseUnits('0.01', 9)
    const noteWallet = new NoteWalletV2(NOTE_WALLET_MNEMONIC, 0)
    const commitments = [];
    for (let i = 0; i < NUM_INITIAL_DEPOSITS; i++) {
      commitments.push(
        ethers.utils.hexZeroPad(
          ethers.BigNumber.from(
            `0x${noteWallet.interiorKeysAt(i).commitment.toString(16)}`
          ),
          32
        )
      )
    }

    const { chainId } = await hre.ethers.provider.getNetwork()
    const signer = await hre.ethers.getSigner()

    const poseidonAddress = poseidonContracts[chainId];
    if (!poseidonAddress || (chainId === 31337)) {
      console.log(`Deploying poseidon contract`)
      const abi = poseidonContract.generateABI(2);
      const bytecode = poseidonContract.createCode(2);

      const poseidon = await deployBytes('Poseidon', abi, bytecode, true, { gasPrice })
      poseidonContracts[chainId] = poseidon.address;
      fs.writeFileSync(
        "./poseidonContracts.json",
        JSON.stringify(poseidonContracts, null, 4)
      );
    }

    console.log(`Deploying Subset Registry`)
    const subsetRegistry = await deploy(
      "SubsetRegistry",
      [],
      true,
      { gasPrice }
    );

    let pools = {}
    for (const denomination of denominations) {
      console.log(`Deploying ${ethers.utils.formatEther(denomination)} ETH Privacy Pool.`)
      const pool = await deploy(
        "PrivacyPool",
        [poseidonContracts[chainId], denomination],
        true,
        { gasPrice }
      );
      pools[denomination] = pool.address
    }

    const tx = await subsetRegistry.addPools(Object.values(pools))
    console.log(`Added pools to subsetRegistry at ${tx.hash}`)

    for (const [denomination, poolAddress] of Object.entries(pools)) {
      console.log(`Depositing ${NUM_INITIAL_DEPOSITS} times into ${ethers.utils.formatEther(denomination)} ETH Privacy Pool...`)
      const pool = new ethers.Contract(poolAddress, PrivacyPoolAbi, signer)
      for (const commitment of commitments) {
        console.log(commitment)
        await pool.deposit(commitment, { value: denomination, gasPrice })
      }
    }

    console.log('Finished.')
}

main().catch(console.error);

