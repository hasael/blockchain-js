const crypto = require('crypto');
const getPort = require('get-port');

const CronJob = require('cron').CronJob;
const express = require("express");
const bodyParser = require('body-parser');
let BlockChain = require("./chain").BlockChain;
let Wallet = require('./wallet').Wallet;
const net = require('net');
const Peers = require('./peers').Peers;
const config = require('config');
const confPeers = config.get('peers');

let MessageType = {
    REQUEST_BLOCK: 'requestBlock',
    RECEIVE_NEXT_BLOCK: 'receiveNextBlock',
    RECEIVE_TRANSACTION: 'receiveTransaction',
    REQUEST_PEERS: 'requestPeers',
    RECEIVE_PEERS: 'receivePeers'
};



const myPeerId = crypto.randomBytes(32);
const peerId = myPeerId.toString('hex');
console.log('myPeerId: ' + peerId);


let myWallet = new Wallet(peerId);
let peers = new Peers();
let isGenesisPeers = false;
let chain;

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
    //peers.addPeer('blockchain2service');
    // peers.addPeer('172.18.0.3');
    console.log('config peers. Before Length: ' + peers.getPeers().length);
    if (confPeers) {
        peers.addPeers(confPeers);
    }
    console.log('config peers. Length: ' + peers.getPeers().length + '. ' + confPeers);
    if (peers.getPeers().length <= 0) {
        isGenesisPeers = true;
        console.log("Starting genesis peer...")
    }
    chain = new BlockChain(2, 1000, peerId, isGenesisPeers);
    const port = await getPort({ port: 30083 });

    const server = net.createServer((socket) => {
        socket.pipe(socket);
    }).on('error', (err) => {
        // Handle errors here.
        throw err;
    });

    server.listen({
        port: 30083,
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
                    writeMessageToPeerIp(from, MessageType.RECEIVE_NEXT_BLOCK, requestedBlock);
                else
                    console.log('No block found @ index: ' + requestedIndex);
                break;
            case MessageType.REQUEST_PEERS:
                writeMessageToPeerIp(from, MessageType.RECEIVE_NEXT_BLOCK, peers.getPeers());
                break;
            case MessageType.RECEIVE_PEERS:
                let receivedPeers = JSON.parse(JSON.stringify(message.data));
                peers.mergePeers(receivedPeers);
                break;
            case MessageType.RECEIVE_NEXT_BLOCK:
                let newBlock = JSON.parse(JSON.stringify(message.data));
                console.log('Adding received block. Current depth ' + chain.getLatestIndex + message.data);
                chain.addBlock(newBlock);
                let nextBlockIndex = chain.getLatestBlock().index + 1;
                console.log('Requesting block ' + nextBlockIndex);
                writeMessageToPeers(MessageType.REQUEST_BLOCK, { index: nextBlockIndex });
                break;
            case MessageType.RECEIVE_TRANSACTION:
                const trx = message.data;
                chain.addTrx(JSON.parse(trx));
                break;
            case MessageType.RECEIVE_NEW_BLOCK:
                chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                break;
        };

        console.log('Blockchain: ' + JSON.stringify(chain.blockchain));
        console.log('peers: ' + peers.getPeers());
    }
})();

function createTransaction(trx) {
    chain.addTrx(trx);
    writeMessageToPeers(MessageType.RECEIVE_TRANSACTION, trx);
}

function writeMessageToPeers(type, data) {
    console.log('peers: ' + peers.getPeers());
    peers.getPeers().forEach(id => {
        console.log('-------- writeMessageToPeers start -------- ');
        console.log('type: ' + type + ', to: ' + id);
        console.log('data: ' + JSON.stringify(data));
        console.log('-------- writeMessageToPeers end ----------- ');
        sendMessage(type, JSON.stringify(data), id);
    })
};

function writeMessageToPeerIp(toIp, type, data) {
    //peers.getPeers().filter(ip == toIp).forEach(ip => {
        console.log('-------- writeMessageToPeerToId start -------- ');
        console.log('type: ' + type + ', to: ' + toIp);
        console.log('data: ' + JSON.stringify(data));
        console.log('-------- writeMessageToPeerToId end ----------- ');
        sendMessage(type, JSON.stringify(data), toIp);
    //}
    //);
};

function sendMessage(type, data, nodeIp) {
    try {
        let msg = JSON.stringify(
            {
                to: nodeIp,
                type: type,
                data: data
            }
        );

        let writeSocket = net.connect({
            host: nodeIp,
            port: 30083,
            writable: true,
        });
        writeSocket.on('error', function (ex) {
            console.log("handled error");
            console.log(ex);
        });

        if (writeSocket) {
            writeSocket.write(msg + '<end>');
            writeSocket.end();
        }

    } catch (error) {
        console.log(error);
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


const updateJob = new CronJob('20 * * * * *', function () {
    writeMessageToPeers(MessageType.REQUEST_BLOCK, { index: chain.getLatestIndex() });
});

updateJob.start();
