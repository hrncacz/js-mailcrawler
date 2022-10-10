const Client = require('ftp');
const fs = require('fs');
const { readdir, rename } = require('fs/promises');
const config = require('config');
const path = require('path');
const { readFile } = require('fs');
const c = new Client();
let { auth, uploadFolder, remoteUp } = config.get('ftp');
const uploadArchive =
  config.get('ftp.uploadArchive') || path.join(uploadFolder, 'archive');

const archiveExist = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(uploadArchive) === false) {
      fs.mkdirSync(uploadArchive);
    }
    resolve();
  });
};

const getFilesToUpload = async () => {
  const pdfRegexp = new RegExp('.pdf$', 'i');
  let filesToUpload = await readdir(uploadFolder);
  filesToUpload = filesToUpload.filter((item) => {
    console.log(pdfRegexp.test(item));
    return pdfRegexp.test(item);
  });
  console.log(filesToUpload);
  // for (let i = 0; i < filesToUpload.length; i++) {
  //   if (/\.pdf$/i.test(filesToUpload[i]) === false) {
  //     filesToUpload.splice(i, 1);
  //   }
  // }
  return filesToUpload;
};

const uploadFilesFtp = async () => {
  c.on('ready', async () => {
    await archiveExist();
    let listOfFiles = await getFilesToUpload();
    if (listOfFiles.length === 0) {
      c.end();
    } else {
      for (let i = 0; i < listOfFiles.length; i++) {
        let filePath = path.join(uploadFolder, listOfFiles[i]);
        readFile(filePath, async (err, data) => {
          if (err) {
            console.error(err.message);
          }
          c.put(data, remoteUp + '/' + listOfFiles[i], (err) => {
            if (err) {
              console.log(err);
              c.abort();
            }
            c.end();
          });
          await rename(filePath, path.join(uploadArchive, listOfFiles[i]));
        });
      }
    }
  });

  c.connect(auth);
};

module.exports = { uploadFilesFtp, getFilesToUpload, archiveExist };
