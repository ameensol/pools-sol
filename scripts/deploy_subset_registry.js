const { deploy } = require("./hardhat.utils.js");

async function main() {
    await deploy(
        "SubsetRegistry",
        [],
        true
    );
}

main().catch(console.error);
