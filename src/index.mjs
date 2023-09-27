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

const initHub = async () => {
  try {
    const { publicKey, privateKey, address } = await utils.getKeyPair();
    console.log(`Starting as Hub, address: '${address}'`);
    const token = await utils.createToken(privateKey, address);

    console.log('#########################################################');
    console.log('\n Start a worker using the following command:\n');
    console.log(`npm start -- -k ${token}`);
    console.log('\n');
    console.log('#########################################################');

    const headers = {
      publickey: Buffer.from(publicKey).toString('base64'),
      token,
    };

    utils.connectSSE(headers, false, (ev) => {
      const { clientid, payload } = ev;
      if(!peers.peers[clientid]) {
        const peer = peers.createPeer(clientid, { initiator: false });
        peer.on('signal', signal => {
          utils.reply({ clientid, ...headers }, signal);
        });
      }
      // I'm fucking up somewhere and answer gets sent to the hub back
      if(payload.type !== "answer") peers.peers[clientid].signal(payload);
    });

    /**
     * The keys are generated, we use the privateKey to sign the client token (this token will be used by worker nodes).
     * At this stage we don't need to share the publicKey with anyone, we are just generating the `address` by hashing
     * the publicKey (SHA-256), in the future we can use the publicKey shared with the `lighthouse` to prevent impersonation(already implemented).
     * The `address` is to find the publicKey in the db.
     */
  }
  catch(e) {
    console.error(e);
  }
};

const initWorker = async k => {
  try {
    const clientid = utils.generateClientId();
    global._clientid = clientid;
    console.log(`Starting as Worker, id: '${clientid}'`);
    const headers = {
      token: apiKey,
      clientid
    };
    utils.connectSSE(headers, () => {
      const peer = peers.createPeer('hub', { initiator: true });
      peer.on('signal', signal => {
        utils.reply(headers, signal);
      });
    }, ev => {
      peers.peers['hub'].signal(ev);
    });
  }
  catch(e) {
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
