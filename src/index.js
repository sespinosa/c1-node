require('dotenv').config();
const argv = require('minimist')(process.argv.slice(2));
const utils = require('./utils');
const peers = require('./utils/peers');


const apiKey = argv.k || argv.key || argv.apikey;

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
     * the publicKey (SHA-256), in the future we can use the publicKey shared with the `lighthouse` to prevent impersonation.
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

if(apiKey) {
  initWorker(apiKey);
}
else {
  initHub();
}
