const sqlite3 = require('sqlite3').verbose();
const config = require('config');
const dbPath = config.get('db.path');
const { v4: uuidv4, validate } = require('uuid');
const { readFile, writeFile } = require('fs/promises');
const path = require('path');
const daysToProcessFiles = config.get('email.daysToProcessFiles');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    return console.error(err);
  }
});

const firstInit = async () => {
  const createEmailsTable =
    'CREATE TABLE emails(uuid, date, subject, sender, hasPdfAttachment, attachments, completed)';
  const createAttachmentsTable =
    'CREATE TABLE attachments(uuid, fromEmail, dateOfDownload, ogFilename, newFilename, fileProcessed)';
  await db.run(createEmailsTable, (err) => {
    if (err) return console.error(err.message);
  });
  await db.run(createAttachmentsTable, (err) => {
    if (err) return console.error(err.message);
  });
  let configPath = path.join(__dirname, 'config', 'default.json');
  let configContent = await readFile(configPath);
  let content = JSON.parse(configContent);
  content.db.tablesExist = true;
  await writeFile(configPath, JSON.stringify(content));
};

const writeEmail = async (foundEmail) => {
  const { date, subject, sender, hasPdfAttachment, attachments, completed } =
    foundEmail;
  const insertEmail = `INSERT INTO emails(uuid, date, subject, sender, hasPdfAttachment, attachments, completed) VALUES(?,?,?,?,?,?,?)`;
  const insertAttachments = `INSERT INTO attachments(uuid, fromEmail, dateOfDownload, ogFilename, newFilename, fileProcessed) VALUES(?,?,?,?,?,?)`;
  let attachmentsUuidArray = [];
  attachments.forEach((attachment) => {
    attachmentsUuidArray.push(attachment.uuid);
  });
  let emailUuid = uuidv4();
  db.run(
    insertEmail,
    [
      emailUuid,
      date,
      subject,
      sender,
      hasPdfAttachment,
      attachmentsUuidArray,
      completed,
    ],
    (err) => {
      if (err) return console.error(err.message);
    }
  );
  for (let i = 0; i < foundEmail.attachments.length; i++) {
    let item = foundEmail.attachments[i];
    db.run(
      insertAttachments,
      [
        item.uuid,
        emailUuid,
        Date.now(),
        item.ogFilename,
        item.newFilename,
        item.fileProcessed,
      ],
      (err) => {
        if (err) return console.error(err.message);
      }
    );
  }
};

const isComplete = (uuid) => {
  return new Promise((resolve, reject) => {
    const checkUuid = `SELECT fileProcessed FROM attachments WHERE uuid = "${uuid}"`;
    if (validate(uuid) === false) {
      //console.error('File name in wrog format');
      resolve(true);
    } else {
      db.all(checkUuid, (err, rows) => {
        if (err) {
          reject(err);
        }
        if (rows.length === 0) {
          //console.error(`This file in not in database! - ${uuid}`);
          resolve(true);
        } else if (rows[0].fileProcessed === 0) {
          resolve(false);
        } else if (rows[0].fileProcessed === 1) {
          resolve(true);
        }
      });
    }
  });
};

const setAttachmentAsProcessed = (uuid) => {
  return new Promise((resolve, reject) => {
    const updateFilePorcessed = `UPDATE attachments SET fileProcessed = 1 WHERE uuid = "${uuid}";`;
    db.run(updateFilePorcessed, (err) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
};

const getFromEmail = (attachmentUuid) => {
  return new Promise((resolve, reject) => {
    let getFromEmailUuid = `SELECT fromEmail FROM attachments WHERE uuid = "${attachmentUuid}"`;
    db.all(getFromEmailUuid, (err, rows) => {
      if (err) reject(err);
      resolve(rows[0].fromEmail);
    });
  });
};

const setEmailAsCompleted = (uuid) => {
  return new Promise((resolve, reject) => {
    const updateFilePorcessed = `UPDATE emails SET completed = 1 WHERE uuid = "${uuid}";`;
    db.run(updateFilePorcessed, (err) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
};

const getIncompleteEmails = () => {
  return new Promise((resolve, reject) => {
    let unprocessedEmails = `SELECT attachments FROM emails WHERE completed = 0`;
    db.all(unprocessedEmails, (err, rows) => {
      if (err) reject(err);
      let checkString = new RegExp(/,/);
      let attachmentsArray = [];
      for (let i = 0; i < rows.length; i++) {
        const str = rows[i].attachments;
        if (checkString.test(str) === true) {
          attachmentsArray.push(str.split(','));
        } else {
          attachmentsArray.push([str]);
        }
      }
      resolve(attachmentsArray);
    });
  });
};

const completeEmails = async () => {
  const emails = await getIncompleteEmails();
  for (let i = 0; i < emails.length; i++) {
    let uuids = emails[i];
    let isEmailComplete = true;
    for (let j = 0; j < uuids.length; j++) {
      let attachmentCompleted = await isComplete(uuids[j]);
      if (attachmentCompleted === false) {
        isEmailComplete = false;
      }
    }
    if (isEmailComplete === true) {
      let fromEmailUuid = await getFromEmail(uuids[0]);
      await setEmailAsCompleted(fromEmailUuid);
    }
  }
};

module.exports = {
  firstInit,
  writeEmail,
  isComplete,
  setAttachmentAsProcessed,
  completeEmails,
};
