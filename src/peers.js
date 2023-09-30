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

// third-party
import Peer from "simple-peer";
import wrtc from "wrtc";

// local
import * as fileShare from "./file-share.js";
import * as peerEvents from "./events.js";

/**
 * Module variables.
 */

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

export const peers = {};

/**
 * Creates a peer with provided id.
 */
export const create = (id, config) => {
  const peer = new Peer({
    trickle: true,
    wrtc,
    iceServers,
    ...config
  });

  peer._id = id;
  peers[id] = peer;
  global.peers = peers;

  peer.on("connect", () => {
    console.log(`Peer (${id}) connected.`);
    peerEvents.onConnect(peers, peer, iceServers);
    fileShare.startSync(peer);
  });

  peer.on("data", (d) => {
    console.log(d.toString());
  });

  peer.on("error", (e) => {
    delete peers[id];
    console.error("Error: ", e);
  });

  peer._pc.addEventListener("connectionstatechange", () => {
    // `simple-peer` (same with PeerJS) is not triggering some events.
    //
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionstatechange_event
    //
    // It looks like the latest implementation of WRTC relies on
    // `connectionstatechange` for the majority of events instead of a
    // per event basis.
    //
    // Possible events:
    // - new
    // - connecting
    // - connected
    // - disconnected
    // - closed
    // - failed

    const { connectionState } = peer._pc;

    switch (connectionState) {
    case "disconnected":
      console.log(`Peer "${peer._id}" disconnected.`);
      delete peers[peer._id];
    }
  });

  return peer;
};
