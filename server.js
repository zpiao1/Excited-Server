const express = require('express');
const crawler = require('./crawler');
const http = require('http');
const logger = require('morgan');
const bodyParser = require('body-parser');
const passport = require('passport');
const authenticate = require('./authenticate');
require('console-stamp')(console);

const app = express();
const hostname = '0.0.0.0';
const port = 3000;

const server = http.createServer(app);
server.listen(port, hostname, () => {
  console.log(`Server running at ${hostname}:${port}`);
  crawler.start();
});

app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(passport.initialize());

const eventRouter = require('./routes/eventRouter');
const userRouter = require('./routes/userRouter');
app.use('/api/events', eventRouter);
app.use('/api/users', userRouter);