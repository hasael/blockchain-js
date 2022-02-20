var assert = require('assert');
const chain = require("../chain");
const wallet = require('../wallet');

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
    describe('wallet', function () {
        beforeEach(function (done) {
            wallet.initWallet();
            done();
        });

        it('should calculate balance', function () {
            let trx = wallet.createFirstTrx();
            wallet.updateTrx(trx);
            let balance = wallet.getBalance();
            assert.equal(balance, trx.output.value);
        });
        
    });
});