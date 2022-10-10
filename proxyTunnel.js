const http = require('http');
const config = require('config');

function getSocketProxy(path) {
  //return socket as a promise
  // Make a request to a tunneling proxy
  let res = new Promise((resolve, reject) => {
    let port = config.get('proxy.connection.port');
    let host = config.get('proxy.connection.host');
    let options = {
      //change host and port to your own http proxy settings
      port: port,
      host: host,
      method: 'CONNECT',
      path,
    };

    const req = http.request(options);
    req.end();

    req.on('connect', (res, socket, head) => {
      resolve(socket);
    });
  });
  return res;
}

module.exports = getSocketProxy;
