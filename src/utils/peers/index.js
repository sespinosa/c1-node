const wrtc = require('wrtc');
const Peer = require('simple-peer');
const peerEvents = require('./events');

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
  global.peers = peers;
  peer.on('connect', () => {
    console.log('------------------------');
    console.log(`Peer (${id}) connected. `);
    console.log('------------------------');
    peerEvents.onConnect(peers, peer);
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