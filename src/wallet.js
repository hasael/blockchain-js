let fs = require('fs'),
    EC = require('elliptic').ec,
    trx = require('./transaction'),
    moment = require("moment"),
    CryptoJS = require("crypto-js");

const ec = new EC('secp256k1');
let privateKeyLocation = __dirname + '/wallet/private_key';

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

const getUtxos = (utxos) => {
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

exports.getBalance = (utxos) => {
    let balance = 0;

    for (let index = 0; index < utxos.values().length; index++) {
        const element = utxos.values()[index];
        if (element.output.receiver == CryptoJS.SHA256(getPublicKey()).toString()) {
            balance += element.output.value;
        }
    }
    return balance;
}

exports.createTrx = (to, value, utxos) => {
    let trxs = [];
    const receiver = CryptoJS.SHA256(to).toString();
    const publicKey = getPublicKey();
    const self = CryptoJS.SHA256(publicKey).toString();
    const utxo = getUtxos(utxos)[0];
    const balance = this.getBalance(utxos);
    if (value < balance) {

        let privateKey = getPrivateKey();
        let signature = toHexString(privateKey.sign(JSON.stringify(utxo)).toDER());
        trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(signature, publicKey, utxo.hash), new trx.TrxOutput(receiver, value)));
        trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(signature, publicKey, utxo.hash), new trx.TrxOutput(self, balance - value)));
    }

    return trxs;
}
function toHexString(byteArray) {
    return Array.prototype.map.call(byteArray, function (byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}

const generatePrivateKey = () => {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};
// let wallet = this;
// let retVal = wallet.initWallet();
// console.log(JSON.stringify(retVal));