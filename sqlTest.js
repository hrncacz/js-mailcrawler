const sqlite3 = require('sqlite3').verbose();
let sql;

const db = new sqlite3.Database('./test.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    return console.error(err);
  }
});

let email = {
  sender: 'm.hrncirik@vollmann-group.com',
  date: '2022-04-14',
  subject: 'kopr',
  hasPdfAttachment: true,
  arrachemnts: [
    {
      uuid: '465sd4f56sdf-s4df65s4df6-65s4df65s4',
      processed: false,
    },
    {
      uuid: 'werw7e89r7-wer68786we7r-wer6874wer64',
      processed: true,
    },
  ],
};

// sql = `CREATE TABLE email(ID, date, subject, sender, hasPdfAttachment, attachments)`;
// db.run(sql);

let dummyArray = [];
email.arrachemnts.forEach((e) => {
  dummyArray.push(e.uuid);
});

// sql = `INSERT INTO emails(uuid, subject, sender, hasPdfAttachments, attachments) VALUES (?,?,?,?,?)`;
// db.run(
//   sql,
//   [
//     '1053e142-b681-4f04-b04d-3cd4b9d4248a',
//     email.subject,
//     email.sender,
//     email.hasPdfAttachment,
//     dummyArray,
//   ],
//   (err) => {
//     if (err) return console.error(err.message);
//   }
// );

// sql = 'SELECT * FROM emails';
// db.all(sql, (err, rows) => {
//   if (err) return console.error(err.message);

//   console.log(rows);
// });

// sql = 'SELECT * FROM attachments';
// db.all(sql, (err, rows) => {
//   if (err) return console.error(err.message);

//   console.log(rows);
// });

// db.run('DROP TABLE attachments');
// db.run('DROP TABLE emails');

// const testFn = () => {
//   console.log(
//     (Date.now() - Date.parse('Mon, 11 Apr 2022 08:19:43 +0200')) / 86400000
//   );
// };

// testFn();
