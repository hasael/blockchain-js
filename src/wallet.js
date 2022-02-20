let EC = require('elliptic').ec,
    fs = require('fs'),
    trx = require('./transaction'),
    moment = require("moment"),
    CryptoJS = require("crypto-js"),
    SimpleHashTable = require('simple-hashtable');

const ec = new EC('secp256k1');
let privateKeyLocation = __dirname + '/wallet/private_key';

var utxos = new SimpleHashTable();
var transactions = new SimpleHashTable();
var previousTrxInputs = [];

exports.initWallet = (peerId) => {
    let dir = privateKeyLocation = __dirname + '/wallet/' + peerId;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    privateKeyLocation = dir + '/private.key';
    let privateKey;
    if (fs.existsSync(privateKeyLocation)) {
        const buffer = fs.readFileSync(privateKeyLocation, 'utf8');
        privateKey = buffer.toString();
    } else {
        privateKey = generatePrivateKey();
        fs.writeFileSync(privateKeyLocation, privateKey);
    }

    const key = ec.keyFromPrivate(privateKey, 'hex');
    const publicKey = key.getPublic().encode('hex');
    return ({ 'privateKeyLocation': privateKeyLocation, 'publicKey': publicKey });
};

const getPublicKey = () => {
    const privateKey = fs.readFileSync(privateKeyLocation).toString('utf-8');
    const key = ec.keyFromPrivate(privateKey, 'hex');
    return key.getPublic().encode('hex');
}

exports.createFirstTrx = () => {
    const receiver = CryptoJS.algo.SHA256.create(getPublicKey()).finalize().toString();
    const value = 10;
    return new trx.Transaction(moment().unix(), {}, new trx.TrxOutput(receiver, value));
}

exports.updateTrx = (trx) => {
    if (!transactions.containsKey(trx.hash)) {
        transactions.put(trx.hash, trx);
    }
    if ((trx.input.previousTrx) && !utxos.isEmpty() && utxos.containsKey(trx.input.previousTrx)) {
        utxos.remove(trx.input.previousTrx);
    }
    previousTrxInputs.push(trx.input.previousTrx);

    let found = false;
    previousTrxInputs.forEach((element, i, arr) => {
        if (!utxos.isEmpty() && utxos.containsKey(element)) {
            utxos.remove(element);
            found = true;
        }
    });

    if (!found && (utxos.isEmpty() || !utxos.containsKey(trx.input.previousTrx))) {
        utxos.put(trx.hash, trx);
    }

}

exports.getBalance = () => {
    let balance = 0;

    for (let index = 0; index < utxos.values().length; index++) {
        const element = utxos.values()[index];
        if (element.output.receiver == CryptoJS.algo.SHA256.create(getPublicKey()).finalize().toString()) {
            balance += element.output.value;
        }
    }
    return balance;
}


const generatePrivateKey = () => {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};
// let wallet = this;
// let retVal = wallet.initWallet();
// console.log(JSON.stringify(retVal));