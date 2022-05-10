const { chain } = require("lodash");
const EC = require('elliptic').ec;
const SimpleHashTable = require('simple-hashtable');
const ec = new EC('secp256k1');

let Block = require("./block.js").Block,
    BlockHeader = require("./block.js").BlockHeader,
    moment = require("moment"),
    CryptoJS = require("crypto-js"),
    level = require('level'),
    fs = require('fs'),
    db;

exports.BlockChain = class BlockChain {
    constructor(difficulty, mineTimeout, peerId, isGenesis) {
        if (isGenesis) {
            this.blockchain = [getGenesisBlock()];
        } else {
            this.blockchain = [];
        }

        this.difficulty = difficulty;
        this.mineTimeout = mineTimeout;
        this.utxos = new SimpleHashTable();
        this.transactions = new SimpleHashTable();
        this.previousTrxInputs = [];
        this.lastBlockMinedTime = 0;
        //createDb(peerId);

    }

    getLatestBlock() { return this.blockchain[this.blockchain.length - 1] };
    getLatestIndex() { return this.blockchain.length };

    addBlock(newBlock) {
        console.log('newBlock json string: ' + JSON.stringify(newBlock));
        console.log('newBlock obj: ' + newBlock);
        if (this.getLatestIndex() > 0) {
            let prevBlock = this.getLatestBlock();
            console.log('prevBlock: ' + JSON.stringify(prevBlock));
            console.log('prevBlock index: ' + prevBlock.index);
            console.log('newBlock.index: ' + newBlock.index);
            console.log('newBlock.blockHeader.previousBlockHeader: ' + newBlock.blockHeader.previousBlockHeader);
            console.log('prevBlock.blockHeader.merkleRoot: ' + prevBlock.blockHeader.merkleRoot);
            console.log('prevBlock.index < newBlock.index: ' + prevBlock.index < newBlock.index);
            console.log('newBlock.blockHeader.previousBlockHeader === prevBlock.blockHeader.merkleRoot: ' + newBlock.blockHeader.previousBlockHeader === prevBlock.blockHeader.merkleRoot);
            if (prevBlock.index < newBlock.index && newBlock.blockHeader.previousBlockHeader === prevBlock.blockHeader.merkleRoot) {
                console.log('Validating block ...');
                if (validateBlock(newBlock, this.getBlock(newBlock.index - 1))) {
                    console.log('--- Inserting block index: ' + newBlock.index);
                    //storeBlock(newBlock);
                    this.blockchain.push(newBlock);

                }
                else {
                    console.log('Invalid block: ' + JSON.stringify(newBlock));
                }
            }
        }
        else {
            this.blockchain.push(JSON.parse(newBlock));

        }
    }
    getBlock(index) {
        if (this.blockchain.length - 1 >= index)
            return this.blockchain[index];
        else
            return null;
    }

    addTrx(trx) {
        if (!this.validateTrx(trx)) {
            console.log('invalid transaction');
            return;
        }

        if (!this.transactions.containsKey(trx.hash)) {
            this.transactions.put(trx.hash, trx);
            this.previousTrxInputs.push(trx.input.previousTrx);
        }
        if ((trx.input.previousTrx) && !this.utxos.isEmpty() && this.utxos.containsKey(trx.input.previousTrx)) {
            this.utxos.remove(trx.input.previousTrx);
        }

        let found = false;
        this.previousTrxInputs.forEach((element, i, arr) => {
            if (element != undefined && !this.utxos.isEmpty() && this.utxos.containsKey(element)) {
                this.utxos.remove(element);
                found = true;
            }
        });

        if (!found && trx.input.previousTrx != undefined && (this.utxos.isEmpty() || !this.utxos.containsKey(trx.input.previousTrx))) {
            this.utxos.put(trx.hash, trx);
        }

        for (let i = 1; i < this.blockchain.length; i++) {
            const block = this.blockchain[i];
            if (block.txns.length < 20 && !block.txns.find(t => t.hash == trx.hash)) {
                block.txns.push(trx);
                break;
            }

        }
    }

    #canMine() {
        const currentTime = moment().unix();
        return (currentTime - this.lastBlockMinedTime) >= this.mineTimeout && this.validateChain();
    }

    mineBlock() {
        try {
            if (this.#canMine()) {
                let nextMerkleRoot = "111111111111";
                let nounce = 0;
                let prevMerkleRoot;
                let nextIndex;
                let nextTime;
                let txns = [];

                do {
                    nounce++;
                    const prevBlock = this.getLatestBlock();
                    prevMerkleRoot = prevBlock.blockHeader.merkleRoot;

                    nextIndex = prevBlock.index + 1;
                    nextTime = moment().unix();

                    var sha256 = CryptoJS.algo.SHA256.create();
                    sha256.update('1');
                    sha256.update(prevMerkleRoot.toString());
                    sha256.update(nextTime.toString());
                    sha256.update(nounce.toString());
                    nextMerkleRoot = sha256.finalize().toString();
                } while (nextMerkleRoot.substring(0, this.difficulty) !== Array(this.difficulty + 1).join("0"))

                const blockHeader = new BlockHeader(1, prevMerkleRoot, nextMerkleRoot, nextTime, null, nounce);
                const newBlock = new Block(blockHeader, nextIndex, txns);
                if (newBlock.blockHeader.time > this.lastBlockMinedTime) {
                    this.lastBlockMinedTime = newBlock.blockHeader.time;
                }
                return newBlock;
            }
            else {
                console.log('cannot mine block yet');
            }
        } catch (error) {
            console.error(error);
        }
    }

    validateChain() {
        for (let i = 1; i < this.blockchain.length; i++) {
            const element = this.blockchain[i];
            if (!validateBlock(element, this.getBlock(i - 1))) {
                return false;
            }
        }
        return true;
    }

    validateTrx = (trx) => {
        if (trx.input.previousTrx == 'coinbase') {
            return true;
        }
        try {
            const key = ec.keyFromPublic(trx.input.publicKey, 'hex');
            const signature = trx.input.signature;
            const prevTrx = this.transactions.get(trx.input.previousTrx);

            let found = 0;
            for (let index = 0; index < this.transactions.values().length; index++) {
                const element = this.transactions.values()[index];
                if (element.input.previousTrx == trx.input.previousTrx) {
                    found++;
                }

            }

            return found <= 2 && key.verify(JSON.stringify(prevTrx), toByteArray(signature));
        } catch (error) {
            console.log(error);
            return false;
        }
    }

}

let createDb = (peerId) => {
    let dir = __dirname + '/db/' + peerId;
    if (!fs.existsSync(__dirname + '/db/')) {
        fs.mkdirSync(__dirname + '/db/');
    }
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    db = level(dir);
    storeBlock(getGenesisBlock());
}

let deleteDb = (peerId) => {
    let dir = __dirname + '/db/' + peerId;
    if (fs.existsSync(dir)) {
        fs.rm(dir);
    }
}

let getGenesisBlock = () => {
    let blockHeader = new BlockHeader(1, '', "0x1bc3300000000000000000000000000000000000000000000", moment().unix(), "0x181b8330", '1DAC2B7C');
    return new Block(blockHeader, 0, null);
};

function toByteArray(hexString) {
    var result = [];
    for (var i = 0; i < hexString.length; i += 2) {
        result.push(parseInt(hexString.substr(i, 2), 16));
    }
    return result;
}

let storeBlock = (newBlock) => {
    if (db) {
        db.put(newBlock.index, JSON.stringify(newBlock), function (err) {
            if (err) return console.log('Ooops!', err) // some kind of I/O error
        })
    }
}

let getDbBlock = (index, res) => {
    db.get(index, function (err, value) {
        if (err) return res.send(JSON.stringify(err));
        return (res.send(value));
    });
}


validateBlock = (block, previousBlock) => {
    if (block.index == 0 && block.txns == null) {
        return true;
    }
    const previousHash = block.blockHeader.previousBlockHeader;
    const time = block.blockHeader.time;
    const nounce = block.blockHeader.nounce;
    const merkleRoot = CryptoJS.algo.SHA256.create()
        .update('1')
        .update(previousHash.toString())
        .update(time.toString())
        .update(nounce.toString())
        .finalize().toString();
    const lastIndexHash = previousBlock.blockHeader.merkleRoot;
    return block.blockHeader.merkleRoot == merkleRoot && lastIndexHash == previousHash;
}
