const jwt = require('jsonwebtoken');
const config = require('./config.json');

exports.generateErrMsg = (req, err) => {
  return {
    method: req.url + ' ' + req.method,
    err: err
  }
};

exports.getToken = (user) => {
  return jwt.sign(user, config.secretKey, {expiresIn: 3600});
};

exports.verify = (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {
    jwt.verify(token, config.secretKey, (err, decoded) => {
      if (err) {
        const err = new Error('You are not authenticated!');
        err.status = 401;
        return next(err);
      } else {
        // save the decoded to the request
        req.decoded = decoded;
        next();
      }
    });
  } else {
    const err = new Error('No token provided!');
    err.status = 403;
    return next(err);
  }
};

