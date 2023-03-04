const fs = require("fs");
const { ethers } = require("ethers");

(async function () {
    const wallet = ethers.Wallet.createRandom();
    const data = `TESTNET_ADDRESS=${wallet.address}\nTESTNET_PRIVATE_KEY=${wallet.privateKey}`;
    console.log({ data });
    console.log(wallet.mnemonic);
})();
