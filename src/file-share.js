/*!
 * c1-node - file-share module
 */

"use strict";

/**
 * File Sharing module.
 * @module file-share
 */

// Here we handle p2p file-sharing.
//
// We will start with star topology beacause mesh can get pretty hard.
//
// Steps:
//
// - Worker connected
// - Hub sends all fs metadata:
//  - mimetype or extension
//  - size in bytes
//  - file name

/**
 * Module dependencies.
 */

// runtime
import fs from 'fs';
import fsP from 'fs/promises';
import path from 'path';

/**
 * Creates a channel for sending files.
 */
const createChannelAndSend = (fileName, peer) => {
  const dc = peer._pc.createDataChannel(`file_${fileName}`);
  const rstream = fs.createReadStream(`./shared/files/${fileName}`);

  console.log(`trying to open datachannel file_${fileName}`);

  setTimeout(() => {
    rstream.on("data", (d) => {
      console.log(`sending chunk (${fileName})`);
      dc.send(d);
    });

    rstream.on("end", () => {
      dc.close();
    });
  }, 1000);
};

/**
 * Synchronises all the nodes.
 */
export const startSync = async (peer) => {
  if (global._role === "hub") {
    const files = await fsP.readdir("./shared/files");

    files.forEach((f) => createChannelAndSend(f, peer));
  }

  if (global._role === "worker") {
    // We are using a different folder on worker so we can test in the
    // same folder (hub and workers)

    fs.existsSync("./w") || fs.mkdirSync("./w");

    if (!fs.existsSync(`./w/${global._clientid}`)) {
      fs.mkdirSync(`./w/${global._clientid}`);

      fs.existsSync(`./w/${global._clientid}/files`)
        || fs.mkdirSync(`./w/${global._clientid}/files`);
    }

    // Here we set global for "local file directory"

    global._localFilePath = path.join(process.cwd(), `./w/${global._clientid}/files`);
  }
};

// export const receiveFiles = () => {};
