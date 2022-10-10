const { Client } = require('ssh2');
const config = require('config');
const fs = require('fs');
let auth = config.get('sftp.auth');
const path = require('path');
const getSocketProxy = require('./proxyTunnel');
let { downloadFolder, remoteDown } = config.get('ftp');
const { isComplete, setAttachmentAsProcessed } = require('./dbHandler');

const downloadFilesSftp = () => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('Client :: Download ready');
      conn.sftp(async (err, sftp) => {
        let filesToDownload;
        const getList = () => {
          return new Promise((resolve, reject) => {
            sftp.readdir(remoteDown, function (err, list) {
              if (err) {
                reject(console.error(err.message));
              }
              resolve(list);
            });
          });
        };
        const sftpReadStream = (file) => {
          return new Promise((resolve, reject) => {
            let readStream = sftp.createReadStream(file);
            resolve(readStream);
          });
        };
        const getFiles = (fileToDownload, pathToSave) => {
          return new Promise((resolve, reject) => {
            fs.open(pathToSave, 'wx', (err, fd) => {
              if (err) {
                resolve(console.log('Soubor již existuje'));
              } else {
                sftpReadStream(fileToDownload)
                  .then((stream) => {
                    stream.once('close', () => {
                      resolve(console.log('Staženo'));
                    });
                    stream.on('error', () => {
                      reject(
                        console.log(
                          'Soubor nemohl být zapsán nebo již existuje'
                        )
                      );
                    });
                    stream.pipe(fs.createWriteStream(pathToSave));
                  })
                  .catch((err) => {
                    console.log(err.message);
                    reject(err);
                  });
              }
            });
          });
        };
        filesToDownload = await getList();
        for (let i = 0; i < filesToDownload.length; i++) {
          let item = filesToDownload[i];
          let itemNameWithDate = item.filename;
          if (
            /\d{8}-\d{6}_/.test(itemNameWithDate) === true &&
            /\.pdf$/i.test(itemNameWithDate) === true
          ) {
            let itemName = itemNameWithDate.split('_')[1];
            let itemUuid = itemName.split('.')[0];
            let itemIsdoc = itemNameWithDate.split('.')[0] + '.isdoc';
            let processed = await isComplete(itemUuid);
            if (/\.pdf$/i.test(itemName) === true && !processed) {
              let pathFrom = `${remoteDown}/${itemNameWithDate}`;
              let pathTo = path.join(downloadFolder, itemNameWithDate);
              let pathFromIsdoc = `${remoteDown}/${itemIsdoc}`;
              let pathToIsdoc = path.join(downloadFolder, itemIsdoc);
              console.log(`Downloading file - ${itemNameWithDate}`);
              await getFiles(pathFrom, pathTo);
              console.log(`Downloading file - ${itemIsdoc}`);

              await getFiles(pathFromIsdoc, pathToIsdoc);

              await setAttachmentAsProcessed(itemUuid);
            }
          }
        }
        console.log('Client :: Download completed');
        conn.end();
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

module.exports = { downloadFilesSftp };
