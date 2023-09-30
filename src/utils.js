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

// runtime
import crypto from "crypto";
import fs from "fs";

// third-party
import * as jose from "jose";
import EventSource from "eventsource";

/**
 * Module variables.
 */

const {
  LIGHTHOUSE_URL = "http://localhost:3000"
} = process.env;

//
// AUTHENTICATION stuff
//

/**
 * Generates private / public RSA encoded key pair.
 */
const generateKeyPair = async () => {
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");

  const publicPEM = await jose.exportSPKI(publicKey);
  const privatePEM = await jose.exportPKCS8(privateKey);

  return {
    privateKey: privatePEM,
    publicKey: publicPEM,
  }
};

/**
 * Returns private / public RSA encoded key pair, storing them for
 * future use when first executed.
 */
export const getKeyPair = async () => {
  if (!fs.existsSync("./key")) {
    fs.mkdirSync("./key");

    const keyPair = await generateKeyPair();

    fs.writeFileSync("./key/x", keyPair.privateKey);
    fs.writeFileSync("./key/x.pub", keyPair.publicKey);

    return keyPair;
  }

  const privateKey = fs.readFileSync("./key/x").toString();
  const publicKey = fs.readFileSync("./key/x.pub").toString();

  return {
    publicKey,
    privateKey,
  };
};

/**
 * Returns a hash built from publicKey (needs to be in PEM format).
 */
export const getAddress = (publicKey) =>
  crypto.createHash("sha256").update(publicKey).digest("hex");

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

/**
 * Generates a random client ID.
 */
export const generateClientId = (l = 16) =>
  crypto.randomBytes(l).toString("hex");

//
// SSE
//

/**
 * Pending:
 * - Add the method to create the peer and link them using the sse implementation.
 * - Add the mechanism for the hub to respond (needs to parse n -> 1 events).
 */

/**
 * Connects to Lighthouse's EventSource
 */
export const connectSSE = (headers = {}, onConnect, onMessage) => {
  const es = new EventSource(`${LIGHTHOUSE_URL}/lighthouse/sse`, { headers });

  es.addEventListener("open", () => {
    if (onConnect) {
      onConnect();
    }
  });

  es.addEventListener("message", (m) => {
    if (onMessage) {
      const event = JSON.parse(m.data);

      onMessage(event);
    }
  });

  es.addEventListener("error", (e) => {
    console.error(e);
  });
};

/**
 * Forwards messages to Replies endpoint.
 */
export const reply = (headers = {}, payload) => {
  fetch(`${LIGHTHOUSE_URL}/lighthouse/r`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  }).catch(console.error)
}
