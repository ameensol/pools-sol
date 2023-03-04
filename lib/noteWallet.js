const { mnemonicToEntropy } = require("@ethersproject/hdnode");
const { Wallet } = require("@ethersproject/wallet");
const { poseidon } = require("./poseidon.js");
const { F } = require("./utils.js");

// see: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const coinType = 9777;

function interiorHdPath(index) {
    return `m/44'/${coinType}'/0'/0/${index}`;
}

function exteriorHdPath(index) {
    return `m/44'/${coinType}'/0'/1/${index}`;
}

function generateInteriorKeys(mnemonic, index) {
    const wallet = Wallet.fromMnemonic(mnemonic, interiorHdPath(index));
    const secret = F.e(wallet.privateKey) % F.p;
    const commitment = poseidon([secret]);
    return { secret, commitment };
}

function generateExteriorKeys(mnemonic, index) {
    const wallet = Wallet.fromMnemonic(mnemonic, exteriorHdPath(index));
    const secret = F.e(wallet.privateKey) % F.p;
    const commitment = poseidon([secret]);
    return { secret, commitment };
}

class NoteWallet {
    constructor(mnemonic, index) {
        try {
            mnemonicToEntropy(mnemonic);
        } catch (err) {
            console.error(err);
            throw new Error(`Invalid mnemonic: ${err}`);
        }
        if (!index) index = 0;
        this.mnemonic = mnemonic;
        this.newInteriorKeysFromPath(index);
    }

    newInteriorKeysFromPath(index) {
        const { secret, commitment } = generateInteriorKeys(
            this.mnemonic,
            index
        );
        this.secret = secret;
        this.commitment = commitment;
    }

    newExteriorKeysFromPath(index) {
        const { secret, commitment } = generateExteriorKeys(
            this.mnemonic,
            index
        );
        this.secret = secret;
        this.commitment = commitment;
    }

    nullifierAt(leafIndex) {
        return poseidon([this.secret, 1, leafIndex]);
    }

    keys() {
        return { secret: this.secret, commitment: this.commitment };
    }

    keysAt(leafIndex) {
        return {
            secret: this.secret,
            commitment: this.commitment,
            nullifier: this.nullifierAt(leafIndex)
        };
    }

    async encryptToJson(password, options, progressCallback) {
        return Wallet.fromMnemonic(this.mnemonic, interiorHdPath(0)).encrypt(
            password,
            options,
            progressCallback
        );
    }

    static async fromEncryptedJson(json, password, progressCallback) {
        return Wallet.fromEncryptedJson(json, password, progressCallback).then(
            (wallet) => {
                return new NoteWallet(wallet.mnemonic.phrase, 0);
            }
        );
    }

    static fromEncryptedJsonSync(json, password) {
        return new NoteWallet(
            Wallet.fromEncryptedJsonSync(json, password).mnemonic.phrase,
            0
        );
    }
}

Object.assign(module.exports, { NoteWallet });
