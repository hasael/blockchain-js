var assert = require('assert');
const chain = require("../chain");
const wallet = require('../wallet');
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
});
describe('wallet', function () {
    beforeEach(function (done) {
        wallet.initWallet(crypto.randomBytes(32).toString('hex'));
        done();
    });

    it('should calculate balance', function () {
        let trx = wallet.createFirstTrx();
        wallet.updateTrx(trx);
        let balance = wallet.getBalance();
        assert.equal(balance, trx.output.value);
    });

    it('should send trx', function () {
        let trx = wallet.createFirstTrx();
        let trxValue = 2;
        wallet.updateTrx(trx);
        let balance = wallet.getBalance();
        assert.equal(balance, trx.output.value);

        let trxs = wallet.createTrx('to', trxValue);
        wallet.updateTrx(trxs[0]);
        wallet.updateTrx(trxs[1]);

        let newbalance = wallet.getBalance();
        assert.equal(newbalance, balance - trxValue);
    });

    it('should not send invalid trx', function () {
        let trx = wallet.createFirstTrx();
        let trxValue = 2;
        wallet.updateTrx(trx);
        let balance = wallet.getBalance();
        assert.equal(balance, trx.output.value);

        let trxs = wallet.createTrx('to', trxValue);

        trxs[0].input.signature = trxs[0].input.signature + '1';
        trxs[1].input.signature = trxs[1].input.signature + '1';
        wallet.updateTrx(trxs[0]);
        wallet.updateTrx(trxs[1]);

        let newbalance = wallet.getBalance();
        assert.equal(newbalance, balance);
    });

});