const express = require('express');
const crawler = require('./crawler');
const http = require('http');
const logger = require('morgan');
const bodyParser = require('body-parser');

const app = express();
const hostname = '0.0.0.0';
const port = 3000;

const server = http.createServer(app);
server.listen(port, hostname, () => {
  console.log(`Server running at ${hostname}:${port}`);
  crawler.start();
});

app.use(logger('dev'));
app.use(bodyParser.json());

const router = require('./routes');
app.use('/api', router);
