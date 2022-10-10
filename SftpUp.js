const { Client } = require('ssh2');
const config = require('config');
const fs = require('fs');
let auth = config.get('sftp.auth');
const path = require('path');
const { rename } = require('fs/promises');
const { getFilesToUpload, archiveExist } = require('./FtpUp');
const getSocketProxy = require('./proxyTunnel');
let { uploadFolder, remoteUp } = config.get('ftp');
const uploadArchive =
  config.get('ftp.uploadArchive') || path.join(uploadFolder, 'archive');

const uploadFilesSftp = () => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('Client :: Upload ready');
      conn.sftp(async (err, sftp) => {
        await archiveExist();
        const putToSftp = (pathFrom, pathTo) => {
          return new Promise((resolve, reject) => {
            sftp.fastPut(pathFrom, pathTo, (err) => {
              if (err) {
                reject(err);
                throw err;
              }
              resolve(console.log('Nahrano'));
            });
          });
        };
        await archiveExist();
        let listOfFiles = await getFilesToUpload();
        console.log(listOfFiles);
        if (listOfFiles.length === 0) {
          conn.end();
        } else {
          for (let i = 0; i < listOfFiles.length; i++) {
            let filePath = path.join(uploadFolder, listOfFiles[i]);
            console.log(listOfFiles[i]);
            console.log(filePath);
            await putToSftp(filePath, remoteUp + '/' + listOfFiles[i]);
            await rename(filePath, path.join(uploadArchive, listOfFiles[i]));
          }
          console.log('Client :: Upload completed');
          conn.end();
        }
      });
      resolve();
    });
    if (config.get('proxy.active') === true) {
      let ftpsServer = `${auth.host}:${auth.port}`;
      auth.sock = getSocketProxy(ftpsServer).then((data) => {
        return data;
      });
      conn.connect(auth);
    } else {
      conn.connect(auth);
    }
  });
};

module.exports = { uploadFilesSftp };
