const { poseidonContract } = require("circomlibjs");
const { deployBytes } = require("./hardhat.utils.js");

// poseidon hash function evm contract
const abi = poseidonContract.generateABI(2);
const bytecode = poseidonContract.createCode(2);

(async function () {
    const signer = await hre.ethers.getSigner();
    console.log(signer);
    const address = '0xfFec2886AD8bfd7D59056E14ef3bE08Eb2C95512'

    // use the signer to send the transaction to address
    const tx = await signer.sendTransaction({
        to: address,
        value: hre.ethers.utils.parseEther("0.5"),
    });
    // await deployBytes("Poseidon", abi, bytecode, true);
})();
