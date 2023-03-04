const { verify } = require("snarkjs").groth16;

// I added this file as a wrapper so that consuming code doesn't need to add
// snarkjs as a dependency
Object.assign(module.exports, {
    verifyProof: async function ({ proof, publicSignals, verifierJson }) {
        return verify(verifierJson, publicSignals, proof);
    }
});
