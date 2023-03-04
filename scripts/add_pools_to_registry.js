const { ethers } = require('hardhat')
const subsetRegistryAbi = require('../build/artifacts/contracts/SubsetRegistry.sol/SubsetRegistry.json').abi

const registries = {
    // 5: '0x5B27a0d86fa25bf74A77f0d0841d292eD4B6f992',
  420: '0x9689c3d7273aCcCb3E530e75A27D8FFcc53e891A'
}

async function main() {
    const { chainId } = await hre.ethers.provider.getNetwork()
    if (!registries[chainId]) return
    const signer = await hre.ethers.getSigner()
    const contract = new ethers.Contract(registries[chainId], subsetRegistryAbi, signer)
    await contract.addPools([
        '0x2613288D37c781D167C415E85548aC4182224dde',
        '0xAefdDCE49Fc8c1fd539e22978EE029D0096E3f70'
    ])
}

main().catch(console.error);
