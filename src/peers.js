/*!
 * c1-node - peers module
 */

"use strict";

/**
 * Peers module.
 * @module peers
 */

/**
 * Module dependencies.
 */
import Peer from "simple-peer";
import wrtc from "wrtc";
import * as fileShare from "./file-share.js";
import * as peerEvents from "./events.js";

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
    peerEvents.onConnect(peers, peer, iceServers);
    fileShare.startSync(peer);
  });

  peer.on('data', data => {
    console.log(data.toString());
  });

  peer.on('error', err => {
    delete peers[id];
    console.error('Error: ', err);
  });

  peer._pc.addEventListener('connectionstatechange', (ev) => {
    /**
     * For some reason `simple-peer` (and also Peerjs) are not triggering some events,
     * and based on: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionstatechange_event
     * it looks like the latest implementation of WRTC relies on the "connectionstatechange" for the mayority
     * of events instead of using event listeners per event basis.
     * Possible events:
     * - new
     * - connecting
     * - connected
     * - disconnected
     * - closed
     * - failer
     */
    const { connectionState } = peer._pc;

    // console.log(`Peer (${peer._id}) state changed to: ${connectionState}`);

    if( connectionState === "disconnected" ) {
      console.log(`Peer "${peer._id}" disconnected.`);
      delete peers[peer._id];
    }

    // console.log("peers: ", Object.keys(peers));
  });

  return peer;
};

export {
  peers,
  createPeer,
};
