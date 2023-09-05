const fs = require('fs');
const crypto = require('crypto');
const JWT = require('jsonwebtoken');
const EventSource = require('eventsource');

const {
  LIGHTHOUSE_URL = 'http://localhost:3000'
} = process.env;

const getKeyPair = async () => {

  if(!fs.existsSync('./key')) {
    fs.mkdirSync('./key', { recursive: true });
    const kp = await generateKeyPair();
    fs.writeFileSync('./key/x', kp.privateKey);
    fs.writeFileSync('./key/x.pub', kp.publicKey);
    return kp;
  }

  if(global._role === "hub") {
    // Bootstrap
    if(!fs.existsSync('./shared')) {
      fs.mkdirSync('./shared');
      if(!fs.existsSync('./shared/files')) fs.mkdirSync('./shared/files');
      if(!fs.existsSync('./shared/wasm')) fs.mkdirSync('./shared/wasm');
      if(!fs.existsSync('./shared/api')) fs.mkdirSync('./shared/api');
    }
  }
  // The worker folder bootstrap is created in the './src/utils/file-share/index.js' file,
  // because this is a POC and the folder will be namespaced with the peer._id in the meantime, like './w/{_id}/files'
  
  const privateKey = fs.readFileSync('./key/x').toString();
  const publicKey = fs.readFileSync('./key/x.pub').toString();
  const address = crypto.createHash('sha256').update(publicKey).digest('hex');

  return { publicKey, privateKey, address };
};

const generateKeyPair = () => new Promise((resolve, reject) => {
  crypto.generateKeyPair(
    "rsa",
    {
      modulusLength: 2048, 
      publicKeyEncoding: {
        type: "pkcs1",
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs1",
        format: "pem"
      },
    },
    (err, publicKey, privateKey) => {
      if (err) return reject(err);
      const address = crypto.createHash('sha256').update(publicKey).digest('hex');
      resolve({ publicKey, privateKey, address });
    }
  );
});

const createToken = (privateKey, address) => new Promise((resolve, reject) => {
  JWT.sign({
    issuer: address,
    audience: 'poc'
  },
  privateKey,
  { algorithm: 'RS256' },
  (err, token) => {
    if(err) return reject(err);
    resolve(token);
  });
});


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

module.exports = {
  getKeyPair,
  createToken,
  generateClientId,
  connectSSE,
  reply
};