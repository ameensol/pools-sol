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

class NoteWalletV2 {
    constructor(mnemonic, index) {
        try {
            mnemonicToEntropy(mnemonic);
        } catch (err) {
            console.error(err);
            throw new Error(`Invalid mnemonic: ${err}`);
        }
        if (!index) index = 0;

        this.interiorKeys = {};
        this.exteriorKeys = {};
        this.interiorKeys[index] = generateInteriorKeys(mnemonic, index);
        this.exteriorKeys[index] = generateExteriorKeys(mnemonic, index);
        this.mnemonic = mnemonic;
    }

    newInteriorKeysFromPath(index) {
        if (typeof this.interiorKeys[index] === "undefined") {
            this.interiorKeys[index] = generateInteriorKeys(
                this.mnemonic,
                index
            );
        }
        return this.interiorKeys[index];
    }

    newExteriorKeysFromPath(index) {
        if (typeof this.exteriorKeys[index] === "undefined") {
            this.exteriorKeys[index] = generateExteriorKeys(
                this.mnemonic,
                index
            );
        }
        return this.exteriorKeys[index];
    }

    interiorNullifierAt(index, leafIndex) {
        if (typeof this.interiorKeys[index] === "undefined") {
            this.interiorKeys[index] = generateInteriorKeys(
                this.mnemonic,
                index
            );
        }
        return poseidon([this.interiorKeys[index].secret, 1, leafIndex]);
    }

    exteriorNullifierAt(index, leafIndex) {
        if (typeof this.exteriorKeys[index] === "undefined") {
            this.exteriorKeys[index] = generateExteriorKeys(
                this.mnemonic,
                index
            );
        }
        return poseidon([this.exteriorKeys[index].secret, 1, leafIndex]);
    }

    interiorKeysAt(index) {
        if (typeof this.interiorKeys[index] === "undefined") {
            this.interiorKeys[index] = generateInteriorKeys(
                this.mnemonic,
                index
            );
        }
        return this.interiorKeys[index];
    }

    exteriorKeysAt(index) {
        if (typeof this.exteriorKeys[index] === "undefined") {
            this.exteriorKeys[index] = generateExteriorKeys(
                this.mnemonic,
                index
            );
        }
        return this.exteriorKeys[index];
    }

    interiorIndexes() {
        return Object.keys(this.interiorKeys);
    }

    exteriorIndexes() {
        return Object.keys(this.exteriorKeys);
    }

    listInteriorKeys() {
        const interiorKeys = new Array();
        this.interiorIndexes().map((index) => {
            interiorKeys.push({ index, ...this.interiorKeys[index] });
        });
        return interiorKeys;
    }

    listExteriorKeys() {
        const exteriorKeys = new Array();
        this.exteriorIndexes().map((index) => {
            exteriorKeys.push({ index, ...this.exteriorKeys[index] });
        });
        return exteriorKeys;
    }

    interiorWithdrawKeysAt(index, leafIndex) {
        const nullifier = this.interiorNullifierAt(index, leafIndex);
        return { nullifier, ...this.interiorKeys[index] };
    }

    exteriorWithdrawKeysAt(index, leafIndex) {
        const nullifier = this.exteriorNullifierAt(index, leafIndex);
        return { nullifier, ...this.exteriorKeys[index] };
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

Object.assign(module.exports, { NoteWalletV2 });
