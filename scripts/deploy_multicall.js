const { deploy } = require("./hardhat.utils.js");

(async function () {
    const multicall2 = await deploy("Multicall2", [], null, true);
    console.log(`Multicall deployed: ${multicall2.address}`);
})();
