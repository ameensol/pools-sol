const { BigNumber } = require("@ethersproject/bignumber");

function getFilledSubtreeIndex(elementIndex, layerIndex) {
    return BigNumber.from(2).mul(
        BigNumber.from(elementIndex).div(
            BigNumber.from(2).pow(BigNumber.from(layerIndex).add(1))
        )
    );
}

Object.assign(module.exports, { getFilledSubtreeIndex });
