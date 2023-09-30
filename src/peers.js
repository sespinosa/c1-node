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

// runtime
import fs from 'fs';

// third-party
import Peer from "simple-peer";
import wrtc from "wrtc";

// local
import * as fileShare from "./file-share.js";

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
 * Creates a mesh of peers.
 */
const createMesh = (peers, peer, iceServers) => {
  // 1.- Peer connects to HUB.
  // 2.- HUB creates 1 datachannel per node.
  // 3.- HUB creates 1 datachannel per existing node in the new peer.
  // 4.- HUB pipes each connection to the new peer (so each peer
  //     has a direct connection with the newly created peer).
  // 5.- Each nodes starts signaling with the new peer until
  //     connected.
  // 6.- After connected, the new peer closes all the datachannels.
  // 7.- ???
  // 8.- Profit.

  if (global._role === "hub") {
    Object.entries(peers).forEach(([k, p]) => {
      if (k !== peer._id) {
        // TODO this should be using
        // RTCPeerConnection.addTransceiver()
        //
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTransceiver

        setTimeout(() => {
          const ds = p._pc.createDataChannel(`mesh_signal_${peer._id}`);
          const dsl = peer._pc.createDataChannel(`mesh_signal_emitter_${k}`);

          ds.addEventListener("message", (m) => dsl.send(m.data));
          dsl.addEventListener("message", (m) => ds.send(m.data));
        }, 2000);
      }
    });
  }

  // TODO this is moist af, should be dry

  if (global._role === "worker") {
    peer._pc.addEventListener("datachannel", ({ channel }) => {
      const clabel = channel.label;

      console.log(`DataChannel Open: ${clabel}`);

      // TODO we are handling saving the file here, this needs
      // refactoring.

      if (clabel.indexOf("file_") === 0) {
        const fileName = clabel.split("_").pop();

        try {
          const file = fs.createWriteStream(`${global._localFilePath}/${fileName}`, "binary");

          channel.addEventListener("message", (m) => {
            file.write(Buffer.from(m.data))
          });

          channel.addEventListener("close", () => {
            console.log(`DataChannel closed on remote, closing file descriptor locally.`);

            file.close();
          });
        }
        catch (err) {
          console.log("file already exists", err)
        }

      }

      if (clabel.indexOf("mesh_signal_") === 0) {
        const is_emitter = clabel.indexOf("mesh_signal_emitter_") === 0;
        const newPeer = new Peer({ trickle: true, wrtc, iceServers, initiator: is_emitter });

        newPeer._id = clabel.split("_").pop();

        newPeer.on("connect", () => {
          console.log(`mesh peer "${newPeer._id}" connected.`);
          peers[newPeer._id] = newPeer;
          // console.log("peers: ", Object.keys(peers));
        });

        newPeer.on("close", () => {
          console.log("new peer closed");
        });

        newPeer.on("signal", (s) => {
          channel.send(JSON.stringify(s));
        });

        channel.addEventListener("message", (m) => {
          newPeer.signal(JSON.parse(m.data));
        });
      }
    });
  }
};

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
    createMesh(peers, peer, iceServers);
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
