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

const getUtxos = () => {
    let retUtxos = [];
    for (let index = 0; index < utxos.values().length; index++) {
        const element = utxos.values()[index];
        if (element.output.receiver == CryptoJS.SHA256(getPublicKey()).toString()) {
            retUtxos.push(element);
        }
    }
    return retUtxos;
}

exports.createFirstTrx = () => {
    const receiver = CryptoJS.SHA256(getPublicKey()).toString();
    const value = 10;
    return new trx.Transaction(moment().unix(), new trx.TrxInput(null, null, 'hash'), new trx.TrxOutput(receiver, value));
}

exports.updateTrx = (trx) => {
    if (!transactions.containsKey(trx.hash)) {
        transactions.put(trx.hash, trx);
        previousTrxInputs.push(trx.input.previousTrx);
    }
    if ((trx.input.previousTrx) && !utxos.isEmpty() && utxos.containsKey(trx.input.previousTrx)) {
        utxos.remove(trx.input.previousTrx);
    }


    let found = false;
    previousTrxInputs.forEach((element, i, arr) => {
        if (element != undefined && !utxos.isEmpty() && utxos.containsKey(element)) {
            utxos.remove(element);
            found = true;
        }
    });

    if (!found && trx.input.previousTrx != undefined && (utxos.isEmpty() || !utxos.containsKey(trx.input.previousTrx))) {
        utxos.put(trx.hash, trx);
    }

}

exports.getBalance = () => {
    let balance = 0;

    for (let index = 0; index < utxos.values().length; index++) {
        const element = utxos.values()[index];
        if (element.output.receiver == CryptoJS.SHA256(getPublicKey()).toString()) {
            balance += element.output.value;
        }
    }
    return balance;
}

exports.createTrx = (to, value) => {
    let trxs = [];
    const receiver = CryptoJS.SHA256(to).toString();
    const self = CryptoJS.SHA256(getPublicKey()).toString();
    const utxo = getUtxos()[0];
    if (value < this.getBalance()) {

        trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(null, null, utxo.hash), new trx.TrxOutput(receiver, value)));
        trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(null, null, utxo.hash), new trx.TrxOutput(self, this.getBalance() - value)));
    }

    return trxs;
}

const generatePrivateKey = () => {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};
// let wallet = this;
// let retVal = wallet.initWallet();
// console.log(JSON.stringify(retVal));