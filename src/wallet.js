let fs = require('fs'),
    EC = require('elliptic').ec,
    trx = require('./transaction'),
    moment = require("moment"),
    CryptoJS = require("crypto-js");

const ec = new EC('secp256k1');

exports.Wallet = class Wallet {
    constructor(peerId) {
        let dir = __dirname + '/wallet/' + peerId;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.privateKeyLocation = dir + '/private.key';

        let privateKey;
        if (fs.existsSync(this.privateKeyLocation)) {
            const buffer = fs.readFileSync(this.privateKeyLocation, 'utf8');
            privateKey = buffer.toString();
        } else {
            privateKey = generatePrivateKey();
            fs.writeFileSync(this.privateKeyLocation, privateKey);
        }
        const key = ec.keyFromPrivate(privateKey, 'hex');
        this.publicKey = key.getPublic().encode('hex');
    }

    createFirstTrx() {
        const receiver = CryptoJS.SHA256(this.publicKey).toString();
        const value = 10;
        return new trx.Transaction(moment().unix(), new trx.TrxInput(null, null, 'coinbase'), new trx.TrxOutput(receiver, value));
    }

    getBalance(utxos) {
        let balance = 0;

        for (let index = 0; index < utxos.values().length; index++) {
            const element = utxos.values()[index];
            if (element.output.receiver == CryptoJS.SHA256(this.publicKey).toString()) {
                balance += element.output.value;
            }
        }
        return balance;
    }

    createTrx (to, value, utxos){
        let trxs = [];
        const receiver = CryptoJS.SHA256(to).toString(); 
        const self = CryptoJS.SHA256(this.publicKey).toString();
        const utxo = filterUtxos(utxos, this.publicKey)[0];
        const balance = this.getBalance(utxos);
        const privateKey = fs.readFileSync(this.privateKeyLocation).toString('utf-8');
        const key = ec.keyFromPrivate(privateKey, 'hex');
        
        if (value < balance) {
    
            let signature = toHexString(key.sign(JSON.stringify(utxo)).toDER());
            trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(signature, this.publicKey, utxo.hash), new trx.TrxOutput(receiver, value)));
            trxs.push(new trx.Transaction(moment().unix(), new trx.TrxInput(signature, this.publicKey, utxo.hash), new trx.TrxOutput(self, balance - value)));
        }
    
        return trxs;
    }
}

const filterUtxos = (utxos, publicKey) => {
    let retUtxos = [];
    for (let index = 0; index < utxos.values().length; index++) {
        const element = utxos.values()[index];
        if (element.output.receiver == CryptoJS.SHA256(publicKey).toString()) {
            retUtxos.push(element);
        }
    }
    return retUtxos;
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