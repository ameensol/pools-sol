const { BitSet } = require("bitset");

/**
 * Deposits is an array of the deposit object:
 * {
 *      sender,
 *      commitment,
 *      enomination,
 *      leafIndex,
 *      timestamp
 * }
 *
 * filterFunction returns true if you want to set the bit there to 1, else false
 *
 * returns a string binary representation, indexed from right to left
 */
async function createSubsetFromFilter({ deposits, filterFunction }) {
    const subset = new BitSet();
    for (let i = 0; i < deposits.length; i++) {
        subset.set(i, filterFunction(deposits[i]) === true ? 1 : 0);
    }
    return subset.toString();
}

Object.assign(module.exports, { createSubsetFromFilter });
