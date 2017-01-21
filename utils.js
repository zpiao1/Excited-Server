const jwt = require('jsonwebtoken');
const config = require('./config.json');
const crypto = require('crypto');
const cipher = crypto.createCipher('aes192', config.secretKey);
const decipher = crypto.createDecipher('aes192', config.secretKey);

exports.generateErrMsg = (req, err) => {
  return {
    method: req.url + ' ' + req.method,
    err: {
      name: err.name,
      message: err.message
    }
  };
};

exports.loginResponse = (user, token) => {
  return {
    status: 'Login successfully!',
    success: true,
    token: token,
    id: user._id
  };
};

exports.getToken = (user) => {
  // expires one year later
  return jwt.sign(user, config.secretKey, {expiresIn: 3600 * 24 * 365});
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
        console.log(req.decoded._doc._id);
        console.log(req.params.id);
        if (req.decoded._doc._id !== req.params.id) {
          const err = new Error('You are not permitted!');
          err.status = 403;
          return next(err);
        }
        next();
      }
    });
  } else {
    const err = new Error('No token provided!');
    err.status = 403;
    return next(err);
  }
};

exports.generateVerifyToken = (user) => {
  let encrypted = cipher.update(user._id + ':' + user.email, 'utf8', 'hex');  // encrypt the user's email and id
  encrypted += cipher.final('hex');
  return encrypted;
};

exports.decryptVerifyToken = (verifyToken) => {
  let decrypted = decipher.update(verifyToken, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  const splited = decrypted.split(':');
  return {
    _id: splited[0],
    email: splited[1]
  };
};