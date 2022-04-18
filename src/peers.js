



exports.Peers = class Peers {
    constructor() {
        this.peers = [];
    }

    getPeers(){
        return this.peers;
    }

    addPeer(peer){
        this.peers.push(peer);
    }

    mergePeers(receivedPeers){
        for (let i = 0; i < receivedPeers.length; i++) {
            let peer = receivedPeers[i];
            if(this.peers.indexOf(peer) < 0){
                this.peers.push(peer);
            }
        }
    }
}