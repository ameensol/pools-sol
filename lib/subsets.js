const { ALLOWED, BLOCKED } = require("./utils");

function leavesToSubsetArray(leaves) {
    const subsetArray = new Array(leaves.length);
    for (let i = 0; i < leaves.length; i++) {
        switch (leaves[i]) {
            case ALLOWED:
                subsetArray[i] = 1;
                break;
            case BLOCKED:
                subsetArray[i] = 0;
                break;
            default:
                throw new Error(
                    `Expected (ALLOWED: ${ALLOWED}) or (BLOCKED: ${BLOCKED}) only, received ${leaves[i]} instead`
                );
        }
    }
    return subsetArray;
}

function subsetArrayToLeaves(subsetArray) {
    const leaves = new Array(subsetArray.length);
    for (let i = 0; i < subsetArray.length; i++) {
        switch (subsetArray[i]) {
            case 1:
                leaves[i] = ALLOWED;
                break;
            case 0:
                leaves[i] = BLOCKED;
                break;
            default:
                throw new Error(
                    `Expected binary inputs only, received ${subsetArray[i]} instead`
                );
        }
    }
    return leaves;
}

function subsetArrayToBuffer(subsetArray) {
    const bitsLength = subsetArray.length;
    if (!bitsLength) return Buffer.alloc(0);

    const tail = bitsLength % 8;
    const bytesLength =
        tail > 0 ? Math.floor(bitsLength / 8) + 1 : Math.floor(bitsLength / 8);

    const buff = Buffer.alloc(bytesLength);

    for (let i = 0; i < bytesLength - 1; i++) {
        buff[i] = 0;
        for (let j = 0; j < 8; j++) {
            const v = subsetArray[i * 8 + j];
            if (v !== 0 && v !== 1) {
                throw new Error(
                    `Expected binary inputs only, received ${v} instead`
                );
            }
            buff[i] = buff[i] | (v << (7 - j));
        }
    }

    buff[bytesLength - 1] = 0;
    for (let i = 0; i < (tail === 0 ? 8 : tail); i++) {
        const v = subsetArray[(bytesLength - 1) * 8 + i];
        if (v !== 0 && v !== 1) {
            throw new Error(
                `Expected binary inputs only, received ${v} instead`
            );
        }
        buff[bytesLength - 1] = buff[bytesLength - 1] | (v << (7 - i));
    }

    return buff;
}

function bufferToSubsetArray(buff, length) {
    if (buff.length === 0) return [];

    const tail = length % 8;
    const bytesLength =
        tail > 0 ? Math.floor(length / 8) + 1 : Math.floor(length / 8);
    if (buff.length < bytesLength) {
        throw Error(
            `Specified bit length ${length} is outside of bounds of Buffer with length ${buff.length}`
        );
    }

    const subsetArray = new Array(length);
    for (let i = 0; i < bytesLength - 1; i++) {
        for (let j = 0; j < 8; j++) {
            if (((buff[i] << j) & 128) === 128) {
                subsetArray[i * 8 + j] = 1;
            } else {
                subsetArray[i * 8 + j] = 0;
            }
        }
    }

    for (let j = 0; j < (tail === 0 ? 8 : tail); j++) {
        if (((buff[bytesLength - 1] << j) & 128) === 128) {
            subsetArray[(bytesLength - 1) * 8 + j] = 1;
        } else {
            subsetArray[(bytesLength - 1) * 8 + j] = 0;
        }
    }

    return subsetArray;
}

function leavesToBuffer(leaves) {
    return subsetArrayToBuffer(leavesToSubsetArray(leaves));
}

function bufferToLeaves(buff, length) {
    return subsetArrayToLeaves(bufferToSubsetArray(buff, length));
}

Object.assign(module.exports, {
    leavesToSubsetArray,
    subsetArrayToLeaves,
    subsetArrayToBuffer,
    bufferToSubsetArray,
    leavesToBuffer,
    bufferToLeaves
});
