var fs = require('fs');
const syswidecas = require('syswide-cas');
syswidecas.addCAs(__dirname + '/ssl');
var { Base64Decode } = require('base64-stream');
var Imap = require('imap');
var path = require('path');
const config = require('config');
const emailConf = config.get('email.auth');
const emailPaths = config.get('email.paths');
const downloadPath = config.get('email.downloadFolder');
var imap = new Imap(emailConf);
const { v4: uuidv4 } = require('uuid');
const { resolve } = require('path');

let foundEmails = [];
let emailObject = {
  date: '',
  subject: '',
  sender: '',
  hasPdfAttachment: false,
  attachments: [],
  completed: false,
};

function flushEmailObject(completedObject, completedHeader) {
  foundEmails.push({
    date: completedHeader.date[0],
    subject:
      typeof completedHeader.subject[0] === 'undefined'
        ? ''
        : completedHeader.subject[0],
    sender: completedHeader.from[0],
    hasPdfAttachment: completedObject.hasPdfAttachment,
    attachments: completedObject.attachments,
    completed: completedObject.completed,
  });
  emailObject.date = '';
  emailObject.subject = '';
  emailObject.sender = '';
  emailObject.hasPdfAttachment = false;
  emailObject.attachments = [];
  emailObject.completed = false;
}

function toUpper(thing) {
  return thing && thing.toUpperCase ? thing.toUpperCase() : thing;
}

function findAttachmentParts(struct, attachments) {
  attachments = attachments || [];

  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (struct[i].disposition) {
        console.log(struct[i].disposition.params);
      }

      if (
        struct[i].disposition &&
        ['INLINE', 'ATTACHMENT'].indexOf(toUpper(struct[i].disposition.type)) >
          -1
      ) {
        if (
          struct[i].subtype == 'pdf' ||
          /\.pdf$|\.pdf\?\=$/i.test(struct[i].description)
        ) {
          attachments.push(struct[i]);
        }
      }
    }
  }
  return attachments;
}

function buildAttMessageFunction(attachment, generatedID) {
  var filename = generatedID + '.pdf';
  var encoding = attachment.encoding;

  return function (msg, seqno) {
    var prefix = '(#' + seqno + ') ';

    msg.on('body', function (stream, info) {
      //Create a write stream so that we can stream the attachment to file;
      //console.log(prefix + 'Streaming this attachment to file', filename, info);
      var writeStream = fs.createWriteStream(path.join(downloadPath, filename));
      writeStream.on('finish', function () {
        console.log(prefix + 'Done writing to file %s', filename);
      });

      //stream.pipe(writeStream); this would write base64 data to the file.
      //so we decode during streaming using
      if (toUpper(encoding) === 'BASE64') {
        //the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
        stream.pipe(new Base64Decode()).pipe(writeStream);
      } else {
        //here we have none or some other decoding streamed directly to the file which renders it useless probably
        stream.pipe(writeStream);
      }
    });
    msg.once('end', function () {
      //console.log(prefix + 'Finished attachment %s', filename);
    });
  };
}

function mailCrawler() {
  return new Promise((resolve, reject) => {
    imap.once('ready', function () {
      imap.openBox('MARTIN', true, function (err, box) {
        if (err) throw err;
        var f = imap.fetch('1:*', {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
          struct: true,
        });
        f.on('message', function (msg, seqno) {
          let header;

          msg.on('body', function (stream, info) {
            var buffer = '';
            stream.on('data', function (chunk) {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', function () {
              header = Imap.parseHeader(buffer);
              if (typeof header.subject === 'undefined') {
                header['subject'] = '';
              }
            });
          });
          msg.once('attributes', function (attrs) {
            var uid = attrs.uid;
            var attachments = findAttachmentParts(attrs.struct);

            for (var i = 0, len = attachments.length; i < len; ++i) {
              var attachment = attachments[i];
              if (attachment.params !== null) {
                let genId = uuidv4();
                var f = imap.fetch(attrs.uid, {
                  //do not use imap.seq.fetch here
                  bodies: [attachment.partID],
                  struct: true,
                });

                emailObject.attachments.push({
                  uuid: genId,
                  ogFilename: attachment.params.name,
                  newFilename: genId + '.pdf',
                  fileProcessed: false,
                });
                emailObject.hasPdfAttachment = true;
                f.on('message', buildAttMessageFunction(attachment, genId));
              }
            }
            if (emailObject.hasPdfAttachment === false) {
              emailObject.completed = true;
              flushEmailObject(emailObject, header);
              msg.once('end', function () {
                imap.move(uid, emailPaths.invalidMails, function (err, code) {
                  if (err) {
                    console.log(err);
                  }
                });
              });
            } else if (emailObject.hasPdfAttachment === true) {
              emailObject.completed = false;
              flushEmailObject(emailObject, header);
              msg.once('end', function () {
                imap.move(uid, emailPaths.processedMails, function (err, code) {
                  if (err) {
                    console.log(err);
                  }
                });
              });
            }
          });
        });
        f.once('error', function (err) {
          console.log('Fetch error: ' + err);
          reject(err);
        });
        f.once('end', function () {
          console.log('Done fetching all messages!');
          imap.end();
        });
      });
    });

    imap.once('error', function (err) {
      console.log(err);
    });

    imap.once('end', function () {
      console.log('Connection ended');
      resolve(foundEmails);
    });

    imap.connect();
  });
}

mailCrawler();

module.exports = mailCrawler;
