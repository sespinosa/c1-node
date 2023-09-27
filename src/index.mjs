/*!
 * c1-node - entry file
 */

"use strict";

/**
 * Program dependencies.
 */
import "dotenv/config";
import minimist from "minimist";
import * as utils from "./utils/index.js";
import * as peers from "./utils/peers/index.js";

/**
 * Initializes HUB node.
 */
const initHub = async () => {
  try {
    // We use privateKey to sign client token (this token will be used
    // by worker nodes).

    // At this stage we don't need to share publickey with anyone, it's
    // only used to generate `address` by hashing its content with
    // SHA-256. In the future publickey can be shared with `lighthouse`
    // to prevent impersonation (already implemented.) TODO: if it's
    // already implemented, why the mention is still here? Check if it's
    // true.

    // `address` is used to find publickey in the database.

    const { privateKey, publicKey, address } = await utils.getKeyPair();

    console.log("Starting HUB at", address);

    const token = await utils.createToken(privateKey, address);

    console.log("\nStart a worker using the following command:\n");
    console.log("\nnpm start -- -k %s\n\n", token);

    const headers = {
      publickey: Buffer.from(publicKey).toString('base64'),
      token,
    };

    utils.connectSSE(headers, false, (ev) => {
      const { clientid, payload } = ev;

      if (!peers.peers[clientid]) {
        const peer = peers.createPeer(clientid, { initiator: false });

        peer.on("signal", (s) => utils.reply({ clientid, ...headers }, s));
      }

      // In case of errors, send `payload` back to HUB

      if (payload.type !== "answer") peers.peers[clientid].signal(payload);
    });
  } catch (e) {
    console.error(e);
  }
};

/**
 * Initializes WORKER node.
 */
const initWorker = (apiKey) => {
  try {
    const clientid = utils.generateClientId();
    global._clientid = clientid;

    console.log("Starting WORKER id", clientid, "with KEY", apiKey);

    const headers = {
      token: apiKey,
      clientid,
    };

    utils.connectSSE(
      headers,
      () => {
        const peer = peers.createPeer("hub", { initiator: true });

        peer.on("signal", (s) => utils.reply(headers, s));
      }, (ev) => {
        peers.peers["hub"].signal(ev);
      });
  } catch (e) {
    console.error(e);
  }
};

/**
 * Entry point of the program.
 */
const main = (argv, env) => {
  const apiKey = argv.k || argv.key || argv.apikey;

  // HUB or WORKER?

  if (apiKey) {
    global._role = 'worker';
    initWorker(apiKey);
  } else {
    global._role = 'hub';
    initHub();
  }
}

main(
  minimist(process.argv.slice(2)),
  {
    LIGHTHOUSE_URL: process.env.LIGHTHOUSE_URL || 'http://localhost:3000'
  }
);
