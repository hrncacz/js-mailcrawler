const Client = require('ftp');
const fs = require('fs');
const config = require('config');

const { isComplete, setAttachmentAsProcessed } = require('./dbHandler');
const path = require('path');
const { auth, downloadFolder, remoteDown } = config.get('ftp');

const downloadFiles = async () => {
  const c = new Client();
  const testFile = new RegExp(/\d{8}-\d{6}_/);
  c.on('ready', async () => {
    let filesToDownload;
    const getList = () => {
      return new Promise((resolve, reject) => {
        c.list(remoteDown, function (err, list) {
          if (err) {
            reject(console.error(err.message));
          }
          resolve(list);
        });
      });
    };
    const getFiles = (fileToDownload, pathToSave) => {
      return new Promise((resolve, reject) => {
        c.get(fileToDownload, (err, stream) => {
          if (err) {
            reject(console.error(err.message));
          }
          stream.once('close', () => {
            resolve();
          });
          stream.pipe(fs.createWriteStream(pathToSave));
        });
      });
    };
    filesToDownload = await getList();
    for (let i = 0; i < filesToDownload.length; i++) {
      let item = filesToDownload[i];
      let itemNameWithDate = item.name;
      if (
        /\d{8}-\d{6}_/.test(itemNameWithDate) === true &&
        /\.pdf$/.test(itemNameWithDate) === true
      ) {
        let itemName = itemNameWithDate.split('_')[1];

        let itemUuid = itemName.split('.')[0];
        let itemIsdoc = itemNameWithDate.split('.')[0] + '.isdoc';
        let processed = await isComplete(itemUuid);
        if (itemName.toLowerCase().endsWith('.pdf') && !processed) {
          let pathFrom = `${remoteDown}/${itemNameWithDate}`;
          let pathTo = path.join(downloadFolder, itemNameWithDate);
          let pathFromIsdoc = `${remoteDown}/${itemIsdoc}`;
          let pathToIsdoc = path.join(downloadFolder, itemIsdoc);
          await getFiles(pathFrom, pathTo);
          await getFiles(pathFromIsdoc, pathToIsdoc);
          await setAttachmentAsProcessed(itemUuid);
        }
      }
    }
    c.end();
  });
  c.connect(auth);
};

module.exports = downloadFiles;
