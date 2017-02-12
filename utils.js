const jwt = require('jsonwebtoken');
const config = require('./config.json');
const crypto = require('crypto');
const Rx = require('@reactivex/rxjs');
const errors = require('./errors');
const AuthenticationError = errors.AuthenticationError;
const NoPermissionError = errors.NoPermissionError;
const TokenMissingError = errors.TokenMissingError;

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
  return jwt.sign(user, config.secretKey, { expiresIn: 3600 * 24 * 365 });
};

exports.verify = (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {
    const verifyObservable = Rx.Observable.bindNodeCallback(jwt.verify);
    verifyObservable(token, config.secretKey)
      .catch(error => {
        return Rx.Observable.throw(new AuthenticationError());
      })
      .do(decoded => {
        req.decoded = decoded;
        console.log(req.decoded._doc._id);
        console.log(req.params.id);
      })
      .flatMap(() => {
        if (req.decoded._doc._id !== req.params.id) {
          return Rx.Observable.throw(new NoPermissionError());
        } else {
          return Rx.Observable.empty();
        }
      })
      .subscribe(() => { }, next, next);
  } else {
    return next(new TokenMissingError());
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
  const split = decrypted.split(':');
  return {
    _id: split[0],
    email: split[1]
  };
};