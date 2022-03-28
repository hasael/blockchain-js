const crypto = require('crypto');
const getPort = require('get-port');

var smoke = require('smokesignal');
const CronJob = require('cron').CronJob;
const express = require("express");
const bodyParser = require('body-parser');
let BlockChain = require("./chain").BlockChain;
let Wallet = require('./wallet').Wallet;
const net = require('net');


let chunks = [];

let MessageType = {
    REQUEST_BLOCK: 'requestBlock',
    RECEIVE_NEXT_BLOCK: 'receiveNextBlock',
    RECEIVE_TRANSACTION: 'receiveTransaction'
};

let peers = [];

const myPeerId = crypto.randomBytes(32);
const peerId = myPeerId.toString('hex');
let chain = new BlockChain(2, 1000, peerId);
let myWallet = new Wallet(peerId);
console.log('myPeerId: ' + peerId);

let initHttpServer = (port) => {
    let http_port = '80' + port.toString().slice(-2);
    let app = express();
    app.use(bodyParser.json());
    app.get('/blocks', (req, res) => res.send(JSON.stringify(chain.blockchain)));
    app.get('/getBlock', (req, res) => {
        let blockIndex = req.query.index;
        res.send(chain.getBlock(blockIndex));
    });
    app.get('/getWallet', (req, res) => {
        res.send(myWallet.publicKey);
    });
    app.listen(http_port, () => console.log('Listening http on port: ' + http_port));
};

(async () => {
    const port = await getPort();
    peers.push('127.0.0.1');
    const server = net.createServer((socket) => {
        socket.pipe(socket);
    }).on('error', (err) => {
        // Handle errors here.
        throw err;
    });

    server.listen({
        host: 'localhost',
        port: 30080,
        exclusive: true
    });

    server.on('connection', (socket) => {
        socket.on('data', data => onRead(socket.remoteAddress, data))
    });

    initHttpServer(port);

    let onRead = (from, data) => {
        let strData = String(data);
        const msgs = strData.split("<end>")

        msgs.forEach(message => {
            if (message && message != "") {
                let msg = null;
                try {
                    msg = JSON.parse(message)
                } catch (error) {
                    console.error(`Could not parse ${message}`)
                    throw error;
                }

                console.log(`----------- Received Message start from: ${from} -------------`);
                console.log(JSON.stringify(msg));
                console.log('----------- Received Message end -------------');

                onMessage(from, msg);
            }
        });

    };

    let onMessage = (from, message) => {
        switch (message.type) {
            case MessageType.REQUEST_BLOCK:
                let requestedIndex = (JSON.parse(message.data)).index;
                let requestedBlock = chain.getBlock(requestedIndex);
                if (requestedBlock)
                    writeMessageToPeerToId(from, MessageType.RECEIVE_NEXT_BLOCK, requestedBlock);
                else
                    console.log('No block found @ index: ' + requestedIndex);
                break;
            case MessageType.RECEIVE_NEXT_BLOCK:
                chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                console.log(JSON.stringify(chain.blockchain));
                let nextBlockIndex = chain.getLatestBlock().index + 1;
                console.log('-- request next block @ index: ' + nextBlockIndex);
                writeMessageToPeers(MessageType.REQUEST_BLOCK, { index: nextBlockIndex });
                break;
            case MessageType.RECEIVE_TRANSACTION:
                const trx = message.data;
                chain.addTrx(JSON.parse(trx));
                console.log(JSON.stringify(chain.blockchain));
                break;
            case MessageType.RECEIVE_NEW_BLOCK:
                chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                console.log(JSON.stringify(chain.blockchain));
                break;
        }
    }
})();

function createTransaction(trx) {
    chain.addTrx(trx);
    writeMessageToPeers(MessageType.RECEIVE_TRANSACTION, trx);
}

function writeMessageToPeers(type, data) {
    peers.forEach(id => {
        console.log('-------- writeMessageToPeers start -------- ');
        console.log('type: ' + type + ', to: ' + id);
        console.log('data: ' + JSON.stringify(data));
        console.log('-------- writeMessageToPeers end ----------- ');
        sendMessage(type, JSON.stringify(data), id);
    })
};

function writeMessageToPeerToId(toId, type, data) {
    peers.filter(id == toId).forEach(id => {
        console.log('-------- writeMessageToPeerToId start -------- ');
        console.log('type: ' + type + ', to: ' + toId);
        console.log('data: ' + JSON.stringify(data));
        console.log('-------- writeMessageToPeerToId end ----------- ');
        sendMessage(type, JSON.stringify(data), id);
    }
    );
};

function sendMessage(type, data, nodeIp) {
    let msg = JSON.stringify(
        {
            to: nodeIp,
            type: type,
            data: data
        }
    );

    chunks.push(msg);
    let writeSocket = net.connect({
        host: nodeIp,
        port: 30080,
        writable: true,
    });


    if (writeSocket) {
        writeSocket.write(msg + '<end>');
        writeSocket.end();
    }
};

const job = new CronJob('30 * * * * *', function () {

    console.log('-----------create next block -----------------');
    let newBlock = chain.mineBlock();
    if (newBlock) {
        chain.addBlock(newBlock);
        console.log(JSON.stringify(newBlock));
        const trx = myWallet.createFirstTrx()
        writeMessageToPeers(MessageType.RECEIVE_NEW_BLOCK, newBlock);
        createTransaction(trx);
    }
    else {
        console.log('Cannot mine block yet!')
    }
    console.log(JSON.stringify(chain.blockchain));
    console.log('-----------create next block -----------------');

});
job.start();


new CronJob('20 * * * * *', function () {
    writeMessageToPeers(MessageType.REQUEST_BLOCK, { index: chain.getLatestBlock().index + 1 });
}).start();
