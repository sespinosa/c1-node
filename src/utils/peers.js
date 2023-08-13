const wrtc = require('wrtc');
const Peer = require('simple-peer');

const peers = {};

const iceServers = [
  {
    urls: "stun:stun.l.google.com:19302"
  },
  {
    urls: "turn:company--1.com:3478?transport=udp",
    username: "test",
    credential: "test"
  },
  {
    urls: "turn:company--1.com:3478?transport=tcp",
    username: "test",
    credential: "test"
  }
];

const createPeer = (id, config) => {
  
  const peer = new Peer({
    trickle: true,
    wrtc,
    iceServers,
    ...config
  });

  peer._id = id;
  peers[id] = peer;
  peer.on('connect', () => {
    console.log('------------------------');
    console.log(`Peer (${id}) connected.`);
    console.log('------------------------');
    setTimeout(() => { // Remove soon
      peer.send(`${Math.random().toFixed(2) * 100} from ${peer._id}`);
    }, 1000);
  });

  peer.on('data', data => {
    console.log(data.toString());
  })
  peer.on('error', err => {
    console.error('Error: ', err);
  })
  return peer;
};

module.exports = {
  peers,
  createPeer,
};