const Peer = require('simple-peer');
const wrtc = require('wrtc');
const fs = require('fs');

const onConnect = (peers, peer) => {
  createMesh(peers, peer);
};

const createMesh = (peers, peer, iceServers) => {
  /**
   * 1.- Peer connects to hub.
   * 2.- Hub creates a datachannel per node.
   * 3.- Hub creates 1 datachannel per existing node in the new peer.
   * 4.- The Hub pipes each connection to the new peer (so each peer has a direct connection with the newly created peer).
   * 5.- Each nodes starts signaling with the new peer until connected.
   * 6.- After connected, the new peer closes all the datachannels.
   * 7.- ???
   * 8.- Profit.
   */

  if(global._role === 'hub') {
    Object.entries(peers).forEach(([k, p]) => {
      if(k !== peer._id) {
        /**
         * This should be using a Transceiver (RTCPeerConnection.addTransceiver())
         * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTransceiver
         */

        setTimeout(() => {
          const ds = p._pc.createDataChannel(`mesh_signal_${peer._id}`);
          const dsl = peer._pc.createDataChannel(`mesh_signal_emitter_${k}`);
  
          ds.addEventListener('message', data => {
            dsl.send(data.data);
          });
  
          dsl.addEventListener('message', data => {
            ds.send(data.data);
          });
        }, 2000);
      }
    });
  }

  /**
   * This is moist af, should be dry.
   */
  if(global._role === 'worker') {
    peer._pc.addEventListener('datachannel', ({ channel }) => {
      const cname = channel.label;

      console.log(`DataChannel Open: ${cname}`);

      // We are handling saving the file here, this needs refactoring.
      if(cname.indexOf('file_') === 0) {
        const fileName = cname.split('_').pop();
        try {
          const file = fs.createWriteStream(`${global._localFilePath}/${fileName}`, 'binary');
          channel.addEventListener('message', data => {
            file.write(Buffer.from(data.data));
          });
          channel.addEventListener('close', () => {
            console.log(`DataChannel closed on remote, closing file descriptor locally.`);
            file.close();
          });
        }
        catch(err) {
          console.log('file already exists', err)
        }

      }
      
      if(cname.indexOf('mesh_signal_') === 0) {
        const is_emitter = cname.indexOf('mesh_signal_emitter_') === 0;
        const newPeer = new Peer({ trickle: true, wrtc, iceServers, initiator: is_emitter });
        
        newPeer._id = cname.split('_').pop();
        
        newPeer.on('connect', () => {
          console.log(`mesh peer "${newPeer._id}" connected.`);
          peers[newPeer._id] = newPeer;
          // console.log('peers: ', Object.keys(peers));
        });

        newPeer.on('close', () => {
          console.log('new peer closed');
        });

        newPeer.on('signal', s => {
          channel.send(JSON.stringify(s));
        });

        channel.addEventListener('message', data => {
          newPeer.signal(JSON.parse(data.data));
        });
      }
    });
  }

};


module.exports = {
  onConnect
};