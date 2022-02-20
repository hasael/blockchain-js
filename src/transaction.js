const CryptoJS = require("crypto-js");

exports.Transaction = class Transaction {

    constructor(time, input, output) {
        this.time = time;
        this.version = 1;
        this.input = input;
        this.output = output;
        this.hash = CryptoJS.algo.SHA256.create()
            .update(this.version.toString())
            .update(JSON.stringify(input))
            .update(JSON.stringify(output))
            .finalize().toString();;
    }
};

exports.TrxInput = class TrxInput {
    constructor(signature, publicKey, previousTrx) {
        this.signature = signature;
        this.publicKey = publicKey;
        this.previousTrx = previousTrx;
    }

}

exports.TrxOutput = class TrxOutput {
    constructor(receiver, value) {
        this.receiver = receiver;
        this.value = value;
    }
}