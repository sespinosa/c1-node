/*!
 * c1-node - utils module
 */

"use strict";

/**
 * Utils module.
 * @module utils
 */

/**
 * Module dependencies.
 */
import crypto from "crypto";
import fs from "fs";
import * as jose from "jose";
import EventSource from "eventsource";

const {
  LIGHTHOUSE_URL = 'http://localhost:3000'
} = process.env;

/**
 * Generates public / private keys and also returns `address`.
 */
const generateKeyPair = async () => {
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");

  const publicPEM = await jose.exportSPKI(publicKey);
  const privatePEM = await jose.exportPKCS8(privateKey);
  const address = crypto.createHash("sha256").update(publicPEM).digest("hex");

  return {
    privateKey: privatePEM,
    publicKey: publicPEM,
    address,
  }
};

/**
 * Returns public / private keys, together with `address`
 */
export const getKeyPair = async () => {
  // TODO this shouldn't be here. I need to reallocate this bootstrap
  // stuff

  if(global._role === "hub") {
    // Bootstrap

    // The worker folder bootstrap is created in the
    // './src/utils/file-share/index.js' file, because this is a POC and
    // the folder will be namespaced with the peer._id in the meantime,
    // like './w/{_id}/files'

    if(!fs.existsSync('./shared')) {
      fs.mkdirSync('./shared');
      if(!fs.existsSync('./shared/files')) fs.mkdirSync('./shared/files');
      if(!fs.existsSync('./shared/wasm')) fs.mkdirSync('./shared/wasm');
      if(!fs.existsSync('./shared/api')) fs.mkdirSync('./shared/api');
    }
  }

  if(!fs.existsSync('./key')) {
    fs.mkdirSync('./key', { recursive: true });
    const kp = await generateKeyPair();
    fs.writeFileSync('./key/x', kp.privateKey);
    fs.writeFileSync('./key/x.pub', kp.publicKey);
    return kp;
  }

  const privateKey = fs.readFileSync('./key/x').toString();
  const publicKey = fs.readFileSync('./key/x.pub').toString();
  const address = crypto.createHash('sha256').update(publicKey).digest('hex');

  return { publicKey, privateKey, address };
};

/**
 * Creates a token.
 */
export const createToken = async (privateKey, address) => {
  const key = await jose.importPKCS8(privateKey, "RS256");

  const token = await new jose.SignJWT({
    // TOOD make all the necessary modifications here and on
    // lighthouse to use the correct claims `aud` and `iss`

    audience: "poc",
    issuer: address,
  })
    .setProtectedHeader({ alg: "RS256" })
    // .setAudience("poc")
    // .setIssuer(address)
    .sign(key);

  return token;
};

const generateClientId = (l = 16) => crypto.randomBytes(l).toString('hex');

const connectSSE = (headers = {}, onConnect, onMessage) => {
  const es = new EventSource(`${LIGHTHOUSE_URL}/lighthouse/sse`, { headers });
  es.addEventListener('open', () => {
    if(onConnect) onConnect();
  });

  es.addEventListener('message', e => {
    const event = JSON.parse(e.data);
    if(onMessage) onMessage(event);
  });

  es.addEventListener('error', e => {
    console.error(e);
  });
};

const reply = (headers = {}, payload) => {
  fetch(`${LIGHTHOUSE_URL}/lighthouse/r`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  }).catch(console.error)
}

/**
 * Pending:
 * - Add the method to create the peer and link them using the sse implementation.
 * - Add the mechanism for the hub to respond (needs to parse n -> 1 events).
 */

export {
  generateClientId,
  connectSSE,
  reply
};
