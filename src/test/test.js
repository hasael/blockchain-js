var assert = require('assert');
const chain = require("../chain");
const Wallet = require('../wallet').Wallet;
const crypto = require('crypto');
describe('blockchain', function () {
    describe('block', function () {
        beforeEach(function (done) {
            chain.setDifficulty(0);
            chain.setMineTimeout(0);
            chain.clear();
            done();
        });

        it('should be able to add', function () {
            let newBlock = chain.mineBlock();
            chain.addBlock(newBlock);
            assert.equal(chain.getLatestBlock().index, 1);
        });
        it('should validate block to add', function () {
            let newBlock = chain.mineBlock();
            newBlock.blockHeader.time = 1
            chain.addBlock(newBlock);
            assert.equal(chain.getLatestBlock().index, 0);
        });
        it('should mine block with the correct difficulty', function () {
            let difficulty = 2;
            chain.setDifficulty(difficulty);
            let newBlock = chain.mineBlock();
            chain.addBlock(newBlock);
            assert.equal(chain.getLatestBlock().blockHeader.merkleRoot.substring(0, difficulty), '00');
        });
        it('should have timeout for block mining', function () {
            let newBlock = chain.mineBlock();
            chain.setMineTimeout(1000);
            chain.addBlock(newBlock);
            assert.equal(chain.getLatestBlock().index, 1);
            let secondBlock = chain.mineBlock();
            assert.equal(secondBlock, undefined);
            assert.equal(chain.getLatestBlock().index, 1);
        });
    });

    describe('transaction', function () {
        beforeEach(function (done) {
            chain.setDifficulty(0);
            chain.setMineTimeout(0);
            chain.clear();
            done();
        });

        it('should calculate balance', function () {
            let wallet = new Wallet(crypto.randomBytes(32).toString('hex'));
            let trx = wallet.createFirstTrx();
            chain.addTrx(trx);
            let balance = wallet.getBalance(chain.utxos);
            assert.equal(balance, trx.output.value);
        });

        it('should send trx', function () {
            let wallet = new Wallet(crypto.randomBytes(32).toString('hex'));
            let wallet2 = new Wallet(crypto.randomBytes(32).toString('hex'));

            let trx = wallet.createFirstTrx();
            let trxValue = 2;
            chain.addTrx(trx);
            let balance = wallet.getBalance(chain.utxos);
            assert.equal(balance, trx.output.value);

            let trxs = wallet.createTrx(wallet2.publicKey, trxValue, chain.utxos);
            chain.addTrx(trxs[0]);
            chain.addTrx(trxs[1]);

            let newbalance = wallet.getBalance(chain.utxos);
            let balance2 = wallet2.getBalance(chain.utxos);
            assert.equal(newbalance, balance - trxValue);
            assert.equal(balance2, trxValue);
        });

        it('should not send invalid trx', function () {
            let wallet = new Wallet(crypto.randomBytes(32).toString('hex'));
            let wallet2 = new Wallet(crypto.randomBytes(32).toString('hex'));
            let trx = wallet.createFirstTrx();
            let trxValue = 2;
            chain.addTrx(trx);
            let balance = wallet.getBalance(chain.utxos);
            assert.equal(balance, trx.output.value);

            let trxs = wallet.createTrx(wallet2.publicKey, trxValue, chain.utxos);

            trxs[0].input.signature = trxs[0].input.signature + '1';
            trxs[1].input.signature = trxs[1].input.signature + '1';
            chain.addTrx(trxs[0]);
            chain.addTrx(trxs[1]);

            let newbalance = wallet.getBalance(chain.utxos);
            let balance2 = wallet2.getBalance(chain.utxos);
            assert.equal(newbalance, balance);
            assert.equal(balance2, 0);
        });

    });
});