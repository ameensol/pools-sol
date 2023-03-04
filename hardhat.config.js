require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");
require("dotenv").config();

// require('hardhat-storage-layout');

const {
    OP_GOERLI_RPC,
    GOERLI_KEY,
    GOERLI_RPC,
    OP_GOERLI_KEY,
    OP_KEY,
    ETH_KEY,
    ETH_RPC,
    SEPOLIA_RPC
} = process.env;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            loggingEnabled: true,
            gasPrice: 1
        },
        sepolia: {
            accounts: [GOERLI_KEY],
            url: SEPOLIA_RPC
        },
        // op: {
        //     accounts: [OP_KEY],
        //     url: OP_RPC
        // },
        op_goerli: {
            accounts: [OP_GOERLI_KEY],
            url: OP_GOERLI_RPC
        },
        // eth: {
        //     accounts: [ETH_KEY],
        //     url: ETH_RPC
        // },
        goerli: {
            accounts: [GOERLI_KEY],
            url: GOERLI_RPC
        }
    },
    paths: {
        sources: "./contracts",
        cache: "./build/cache",
        artifacts: "./build/artifacts",
        tests: "./test"
    },
    solidity: {
        compilers: [
            {
                version: "0.8.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1048576 * 2
                    }
                }
            }
        ]
    }
};
