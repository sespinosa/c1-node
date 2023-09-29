/*!
 * c1-node - file-share module
 */

"use strict";

/**
 * File Sharing module.
 * @module file-share
 */

/**
 * Here we handle the p2p file-sharing, we will start with the star topology beacause mesh can get pretty hard.
 * Steps:
 * - Worker connected
 * - Hub sends all fs metadata:
 *  - mimetype or extension
 *  - size in bytes
 *  - file name
 */

/**
 * Module dependencies.
 */
import fs from 'fs';
import fsP from 'fs/promises';
import path from 'path';

const startSync = async (peer) => {
  if(global._role === 'hub') {
    const files = await fsP.readdir('./shared/files');
    files.forEach(fp => createChannelAndSend(fp, peer));
  }

  if(global._role === 'worker') {
    // We are using a different folder on the worker so we can test in the same folder (hub and workers)
    if(!fs.existsSync('./w')) {
      fs.mkdirSync('./w');
    }
    if(!fs.existsSync(`./w/${global._clientid}`)) {
      fs.mkdirSync(`./w/${global._clientid}`);
      if(!fs.existsSync(`./w/${global._clientid}/files`)) fs.mkdirSync(`./w/${global._clientid}/files`);
    }
    // Here we set the global for the "local file directory"
    global._localFilePath = path.join(process.cwd(), `./w/${global._clientid}/files`);
    // global._localFilePath = `./w/${global._clientid}/files`;
  }
};

const createChannelAndSend = (fileName, peer) => {
  const ds = peer._pc.createDataChannel(`file_${fileName}`);
  const file = fs.createReadStream(`./shared/files/${fileName}`);
  console.log(`trying to open datachannel file_${fileName}`);
  setTimeout(() => {
    file.on('data', data => {
      console.log(`sending chunk (${fileName})`);
      ds.send(data);
    });
    file.on('end', () => {
      ds.close();
    });
  }, 1000);
};


const receiveFiles = async () => {};

export {
  startSync,
  receiveFiles
};
