const { chain } = require("lodash");

let Block = require("./block.js").Block,
    BlockHeader = require("./block.js").BlockHeader,
    moment = require("moment"),
    CryptoJS = require("crypto-js"),
    level = require('level'),
    fs = require('fs'),
    db;

let difficulty = 1;
let mineTimeout = 1;
let lastBlockMinedTime = moment().unix();

let createDb = (peerId) => {
    let dir = __dirname + '/db/' + peerId;
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

let getLatestBlock = () => blockchain[blockchain.length - 1];

let addBlock = (newBlock) => {
    let prevBlock = getLatestBlock();
    if (prevBlock.index < newBlock.index && newBlock.blockHeader.previousBlockHeader === prevBlock.blockHeader.merkleRoot) {
        if (validateBlock(newBlock)) {
            storeBlock(newBlock);
            blockchain.push(newBlock);
            if (newBlock.blockHeader.time > lastBlockMinedTime) {
                lastBlockMinedTime = newBlock.blockHeader.time;
            }
        }
        else {
            console.log('Invalid block: ' + JSON.stringify(newBlock));
        }
    }
}

let addTrx = (trx) => {
    for (i = 1; i < blockchain.length; i++) {
        const block = blockchain[i];
        if(block.txns.length < 20 && !block.txns.find(t => t.hash == trx.hash)){
            block.txns.push(trx);
            break;
        }

    }
}

let getBlock = (index) => {
    if (blockchain.length - 1 >= index)
        return blockchain[index];
    else
        return null;
}

let storeBlock = (newBlock) => {
    if (db) {
        db.put(newBlock.index, JSON.stringify(newBlock), function (err) {
            if (err) return console.log('Ooops!', err) // some kind of I/O error
            console.log('--- Inserting block index: ' + newBlock.index);
        })
    }
}

let getDbBlock = (index, res) => {
    db.get(index, function (err, value) {
        if (err) return res.send(JSON.stringify(err));
        return (res.send(value));
    });
}

const mineBlock = () => {
    if (canMine()) {
        let nextMerkleRoot = "111111111111";
        let nounce = 0;
        let prevMerkleRoot;
        let nextIndex;
        let nextTime;
        let txns = [];

        do {
            nounce++;
            const prevBlock = getLatestBlock();
            prevMerkleRoot = prevBlock.blockHeader.merkleRoot;

            nextIndex = prevBlock.index + 1;
            nextTime = moment().unix();

            var sha256 = CryptoJS.algo.SHA256.create();
            sha256.update('1');
            sha256.update(prevMerkleRoot.toString());
            sha256.update(nextTime.toString());
            sha256.update(nounce.toString());
            nextMerkleRoot = sha256.finalize().toString();
        } while (nextMerkleRoot.substring(0, difficulty) !== Array(difficulty + 1).join("0"))

        const blockHeader = new BlockHeader(1, prevMerkleRoot, nextMerkleRoot, nextTime, null, nounce);
        const newBlock = new Block(blockHeader, nextIndex, txns);
        return newBlock;
    }
};


validateBlock = (block) => {
    if (block.index == 0 && block.txns == null) {
        return true;
    }
    const previousHash = block.blockHeader.previousBlockHeader;
    const time = block.blockHeader.time;
    const nounce = block.blockHeader.nounce;
    const txns = block.txns;
    const merkleRoot = CryptoJS.algo.SHA256.create()
        .update('1')
        .update(previousHash.toString())
        .update(time.toString())
        .update(nounce.toString())
        .finalize().toString();
    const index = block.index;
    const lastIndexHash = getBlock(index - 1).blockHeader.merkleRoot;
    return block.blockHeader.merkleRoot == merkleRoot && lastIndexHash == previousHash;
}

validateChain = () => {
    for (let i = 0; i < blockchain.length; i++) {
        const element = blockchain[i];
        if (!validateBlock(element)) {
            return false;
        }
    }
    return true;
}

let canMine = () => {
    const currentTime = moment().unix();
    return (currentTime - lastBlockMinedTime) >= mineTimeout && validateChain();
}

let setDifficulty = (d) => {
    difficulty = d;
}
let clear = () => {
    blockchain = [getGenesisBlock()];
}
let setMineTimeout = (time) => {
    mineTimeout = time;
}

let blockchain = [getGenesisBlock()];
exports.blockchain = blockchain;
if (typeof exports != 'undefined') {
    exports.addBlock = addBlock;
    exports.getBlock = getBlock;
    exports.blockchain = blockchain;
    exports.getLatestBlock = getLatestBlock;
    exports.mineBlock = mineBlock;
    exports.createDb = createDb;
    exports.deleteDb = deleteDb;
    exports.getDbBlock = getDbBlock;
    exports.getGenesisBlock = getGenesisBlock;
    exports.clear = clear;
    exports.setDifficulty = setDifficulty;
    exports.setMineTimeout = setMineTimeout;
    exports.addTrx = addTrx;
}