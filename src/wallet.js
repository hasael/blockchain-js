let EC = require('elliptic').ec,
    fs = require('fs'),
    trx = require('./transaction'),
    moment = require("moment"),
    CryptoJS = require("crypto-js"),
    SimpleHashTable = require('simple-hashtable'),
    crypto = require('crypto');

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

const getPrivateKey = () => {
    const privateKey = fs.readFileSync(privateKeyLocation).toString('utf-8');
    const key = ec.keyFromPrivate(privateKey, 'hex');
    return key;
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
    return new trx.Transaction(moment().unix(), new trx.TrxInput(null, null, 'coinbase'), new trx.TrxOutput(receiver, value));
}

exports.updateTrx = (trx) => {
    if (!validateTrx(trx)) {
        console.log('invalid transaction');
        return;
    }
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

validateTrx = (trx) => {
    if (trx.input.previousTrx == 'coinbase') {
        return true;
    }
    try {


        const key = ec.keyFromPublic(trx.input.publicKey, 'hex');
        const signature = trx.input.signature;
        const prevTrx = transactions.get(trx.input.previousTrx);
        return key.verify(JSON.stringify(prevTrx), toByteArray(signature));
    } catch (error) {
        console.log(error);
        return false;
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
function toHexString(byteArray) {
    return Array.prototype.map.call(byteArray, function (byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}
function toByteArray(hexString) {
    var result = [];
    for (var i = 0; i < hexString.length; i += 2) {
        result.push(parseInt(hexString.substr(i, 2), 16));
    }
    return result;
}
exports.createTrx = (to, value) => {
    let trxs = [];
    const receiver = CryptoJS.SHA256(to).toString();
    const publicKey = getPublicKey();
    const self = CryptoJS.SHA256(publicKey).toString();
    const utxo = getUtxos()[0];
    if (value < this.getBalance()) {

        let privateKey = getPrivateKey();
        let signature = toHexString(privateKey.sign(JSON.stringify(utxo)).toDER());
        trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(signature, publicKey, utxo.hash), new trx.TrxOutput(receiver, value)));
        trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(signature, publicKey, utxo.hash), new trx.TrxOutput(self, this.getBalance() - value)));
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