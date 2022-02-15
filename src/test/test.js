var assert = require('assert');
const chain = require("../chain");

describe('blockchain', function () {
    describe('block', function () {
        beforeEach(function (done) {
            chain.clear();
            done();
        });
      
        it('should be able to add', function () {
            let newBlock = chain.generateNextBlock({data: 'test'}, 1);
            chain.addBlock(newBlock);
            assert.equal(chain.getLatestBlock().index, 1);
        });
        it('should validate block to add', function () {
            let newBlock = chain.generateNextBlock({ data: 'data' }, 1);
            newBlock.txns = { data: 'tampered' };
            chain.addBlock(newBlock);
            assert.equal(chain.getLatestBlock().index, 0);
        });
    });
});