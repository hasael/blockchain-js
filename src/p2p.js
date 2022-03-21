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
    REQUEST_ALL_REGISTER_MINERS: 'requestAllRegisterMiners',
    REGISTER_MINER: 'registerMiner',
    RECEIVE_TRANSACTION: 'receiveTransaction'
};

const peers = {};
let connSeq = 0;
let registeredMiners = [];
let lastBlockMinedBy = null;

const myPeerId = crypto.randomBytes(32);
const strPeerId = myPeerId.toString('hex');
let chain = new BlockChain(2, 1000, strPeerId);
let myWallet = new Wallet(strPeerId);
console.log('myPeerId: ' + strPeerId);

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

//const config = defaults({
//    id: myPeerId,
//});


let writeSocket;

(async () => {
    const port = await getPort();
    const server = net.createServer((socket) => {
        // 'connection' listener.
        console.log('client connected');
        socket.on('end', () => {
            console.log('client disconnected');
        });
        socket.write('hello\r\n');
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
        socket.on('data', onRead)
    });

    writeSocket = net.connect({
        port: 30080,
        writable: true,
    });

    initHttpServer(port);
    console.log('Listening port: ' + port);

    let onRead = (data) => {
        let strData = String(data);
        const msgs = strData.split("<end>")
        console.log('data: ' + strData);
        console.log('datas: ' + msgs);

        msgs.forEach(message => {
            if (message && message != "") {
                let msg = null;
                try {
                    msg = JSON.parse(message)
                } catch (error) {
                    console.error(`Could not parse ${message}`)
                    throw error;
                }

                console.log('----------- Received Message start -------------');
                console.log(
                    // 'from: ' + peerId.toString('hex'),
                    //'to: ' + peerId.toString(message.to),
                    //'my: ' + strPeerId,
                    'type: ' + JSON.stringify(msg.type)
                );
                console.log('----------- Received Message end -------------');

                onMessage(msg);
            }
        });

    };

    let onMessage = (message) => {
        switch (message.type) {
            case MessageType.REQUEST_BLOCK:
                console.log('-----------REQUEST_BLOCK-------------');
                let requestedIndex = (JSON.parse(JSON.stringify(message.data))).index;
                let requestedBlock = chain.getBlock(requestedIndex);
                if (requestedBlock)
                    writeMessageToPeerToId(peerId.toString('hex'), MessageType.RECEIVE_NEXT_BLOCK, requestedBlock);
                else
                    console.log('No block found @ index: ' + requestedIndex);
                console.log('-----------REQUEST_BLOCK-------------');
                break;
            case MessageType.RECEIVE_NEXT_BLOCK:
                console.log('-----------RECEIVE_NEXT_BLOCK-------------');
                chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                console.log(JSON.stringify(chain.blockchain));
                let nextBlockIndex = chain.getLatestBlock().index + 1;
                console.log('-- request next block @ index: ' + nextBlockIndex);
                writeMessageToPeers(MessageType.REQUEST_BLOCK, { index: nextBlockIndex });
                console.log('-----------RECEIVE_NEXT_BLOCK-------------');
                break;
            case MessageType.RECEIVE_TRANSACTION:
                console.log('-----------RECEIVE_TRANSACTION-------------');
                const trx = message.data;
                chain.addTrx(JSON.parse(trx));
                console.log(JSON.stringify(chain.blockchain));
                console.log('-----------RECEIVE_TRANSACTION-END-------------');
                break;
            case MessageType.REQUEST_ALL_REGISTER_MINERS:
                console.log('-----------REQUEST_ALL_REGISTER_MINERS------------- ' + message.to);
                writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
                registeredMiners = JSON.parse(message.data);
                console.log('-----------REQUEST_ALL_REGISTER_MINERS------------- ' + message.to);
                break;
            case MessageType.REGISTER_MINER:
                console.log('-----------REGISTER_MINER------------- ' + message.to);
                let miners = message.data;
                registeredMiners = JSON.parse(miners);
                console.log(registeredMiners);
                console.log('-----------REGISTER_MINER------------- ' + message.to);
                break;
            case MessageType.RECEIVE_NEW_BLOCK:
                // if (message.to === strPeerId && message.from !== strPeerId) {
                console.log('-----------RECEIVE_NEW_BLOCK------------- ' + message.to);
                chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                console.log(JSON.stringify(chain.blockchain));
                console.log('-----------RECEIVE_NEW_BLOCK------------- ' + message.to);
                // }
                break;
        }
    }

    let onDisconnect = () => {

        console.log(`Connection closed, peerId: ${strPeerId}`);
        if (peers[peerId].seq === seq) {
            delete peers[peerId];
            console.log('--- registeredMiners before: ' + JSON.stringify(registeredMiners));
            let index = registeredMiners.indexOf(peerId);
            if (index > -1)
                registeredMiners.splice(index, 1);
            console.log('--- registeredMiners end: ' + JSON.stringify(registeredMiners));
        }

    };

    let onConnect = (conn, info) => {
        const seq = connSeq;
        const peerId = info.id.toString('hex');
        console.log(`Connected #${seq} to peer: ${peerId}`);

        if (info.initiator) {
            try {
                conn.setKeepAlive(true, 600);
            } catch (exception) {
                console.log('exception', exception);
            }
        }
        //node.broadcast.write('HEYO! I\'m here');
        /*if (!peers[peerId]) {
            peers[peerId] = {}
        }
        peers[peerId].conn = conn;
        peers[peerId].seq = seq;*/
        connSeq++
    };
})();

setTimeout(function () {
    writeMessageToPeers(MessageType.REQUEST_BLOCK, { index: chain.getLatestBlock().index + 1 });
}, 5000);

setTimeout(function () {
    writeMessageToPeers(MessageType.REQUEST_ALL_REGISTER_MINERS, [])
}, 4000);

setTimeout(function () {
    if (!registeredMiners)
        registeredMiners = [];
    if (!registeredMiners.includes(strPeerId)) {
        registeredMiners.push(strPeerId);
        console.log('----------Register my miner --------------');
        console.log(registeredMiners);
        writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
        console.log('---------- Register my miner --------------');
    }
}, 7000);

function createTransaction(trx) {
    console.log('----------Send my transaction --------------');
    chain.addTrx(trx);
    writeMessageToPeers(MessageType.RECEIVE_TRANSACTION, trx);
    console.log('----------Send my transaction --------------');
}

function writeMessageToPeers(type, data) {
    //for (let id in peers) {
    console.log('-------- writeMessageToPeers start -------- ');
    console.log('type: ' + type + ', to: all');
    console.log('data: ' + JSON.stringify(data));
    console.log('-------- writeMessageToPeers end ----------- ');
    sendMessage(type, JSON.stringify(data));
    // }
};

function writeMessageToPeerToId(toId, type, data) {
    //for (let id in peers) {
    //if (id === toId) {
    console.log('-------- writeMessageToPeerToId start -------- ');
    console.log('type: ' + type + ', to: ' + toId);
    console.log('data: ' + JSON.stringify(data));
    console.log('-------- writeMessageToPeerToId end ----------- ');
    sendMessage(type, JSON.stringify(data));
    //  }
    //}
};

function sendMessage(type, data) {
    let msg = JSON.stringify(
        {
            to: 'all',
            from: strPeerId,
            type: type,
            data: data
        }
    );

    chunks.push(msg);
    if (writeSocket) {
        writeSocket.write(msg + '<end>');
    }
};

const job = new CronJob('30 * * * * *', function () {
    let index = 0; // first block
    if (lastBlockMinedBy) {
        let newIndex = registeredMiners.indexOf(lastBlockMinedBy);
        index = (newIndex + 1 > registeredMiners.length - 1) ? 0 : newIndex + 1;
    }
    lastBlockMinedBy = registeredMiners[index];
    console.log('-- REQUESTING NEW BLOCK FROM: ' + registeredMiners[index] + ', index: ' + index);
    console.log(JSON.stringify(registeredMiners));
    if (registeredMiners[index] === strPeerId) {
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
    }
});
job.start();
