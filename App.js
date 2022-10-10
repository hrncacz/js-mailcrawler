const mailCrawler = require('./MailCrawler');
const { firstInit, writeEmail, completeEmails } = require('./dbHandler');
const config = require('config');
const { uploadFilesFtp } = require('./FtpUp');
const downloadFiles = require('./FtpDown');
const { uploadFilesSftp } = require('./SftpUp');
const { downloadFilesSftp } = require('./SftpDown');

const pause = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve(), ms);
  });
};

async function main() {
  if (!config.get('db.tablesExist')) {
    await firstInit();
  }
  const processEmails = await mailCrawler();
  for (let i = 0; i < processEmails.length; i++) {
    await writeEmail(processEmails[i]);
  }
  await pause(5000);
  if (config.get('sftp.active') === false) {
    await uploadFilesFtp();
    await pause(10000);
    //await downloadFiles();
    await pause(10000);
  } else if (config.get('sftp.active') === true) {
    await uploadFilesSftp();
    await downloadFilesSftp();
  }
  await completeEmails();
}
main();
