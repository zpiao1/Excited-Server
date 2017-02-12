const express = require('express');
const userRouter = express.Router();
const passport = require('passport');
const Users = require('../models/users');
const utils = require('../utils');
const config = require('../config.json');
const database = require('../database');
const request = require('request');
const Mailer = require('../nodemailer');
const userErrs = require('passport-local-mongoose').errors;
const imageUpload = require('../fileupload');
const fs = require('fs');
const path = require('path');
const errors = require('../errors');
const Rx = require('@reactivex/rxjs');

userRouter.post('/register', (req, res) => {
  Users.findOne({ email: req.body.email })
    .exec((err, user) => {
      if (err) {
        console.error(err);
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      }
      if (user) {
        const tempUserInfo = {};
        if (user.facebookProfile) {
          tempUserInfo.facebookProfile = JSON.parse(JSON.stringify(user.facebookProfile));
        }
        if (user.googleProfile) {
          tempUserInfo.googleProfile = JSON.parse(JSON.stringify(user.googleProfile));
        }
        Users.remove({ email: req.body.email })
          .exec((err, info) => {
            if (err) {
              console.error(err);
              return res.status(500)
                .json(utils.generateErrMsg(req, err));
            }
            registerUser(req, res, tempUserInfo);
          });
      } else {
        registerUser(req, res);
      }
    });
});

userRouter.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error(err);
      return next(err);
    }
    if (!user) {
      const err = new Error('Email/Password error!');
      err.name = 'UserPasswordError';
      return res.status(401)
        .json(utils.generateErrMsg(req, err));
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error(err);
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      }
      if (!user.verified) {
        res.status(403).json(utils.generateErrMsg(req, 'User is not verified!'));
      }
      const token = utils.getToken(user);
      res.status(200).json(utils.loginResponse(user, token));
    });
  })(req, res, next);
});

userRouter.get('/logout', (req, res) => {
  req.logOut();
  res.status(200).json({
    status: 'Bye!',
    success: true
  });
});

userRouter.post('/facebook', (req, res, next) => {
  passport.authenticate('facebook-token', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json(utils.generateErrMsg(req, info));
    }
    loginUser(req, res, user);
  })(req, res, next);
});

userRouter.post('/google', (req, res, next) => {
  googleAuthenticate(req.query.id_token)
    .then(user => {
      const resUser = { // response user from Google authentications
        googleProfile: {
          email: user.email,
          googleId: user.sub,
          displayName: user.given_name + ' ' + user.family_name,
          imageUrl: user.picture,
        },
        verified: true
      };
      database.saveUser(resUser, (err, user) => {
        if (err) {
          console.error('Error in saving google user: ' + JSON.stringify(resUser, null, 2));
          console.error(err);
        } else {
          loginUser(req, res, user);
        }
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json(utils.generateErrMsg(req, err));
    });
});

userRouter.get('/verify', (req, res) => {
  const verifyToken = req.query.verify_token;
  if (!verifyToken) {
    return res.status(404).end('<h1>No verification token</h1>');
  }
  const user = utils.decryptVerifyToken(verifyToken);
  Users.findOne({ _id: user._id, email: user.email })
    .exec((err, user) => {
      if (err) {
        return res.status(500).end('<h1>Internal Error</h1>');
      }
      if (!user) {
        return res.status(404).end('<h1>User not found</h1>');
      }
      user.verified = true;
      user.localProfile.verifyToken = undefined;  // clear the verifyToken
      user.save((err, user) => {
        if (err) {
          return res.status(500).end('<h1>Internal Error</h1>');
        }
        return res.status(200).end(`<h1>Congratulations!</h1>
<p>You account is verified. Welcome to Excited!</p>`);
      });
    });
});

userRouter.route('/:id')
  .get(utils.verify, (req, res, next) => {
    Users.findById(req.params.id)
      .select({
        _id: 1,
        email: 1,
        verified: 1,
        localProfile: 1,
        facebookProfile: 1,
        googleProfile: 1,
        hasLocalProfile: 1
      })
      .exec((err, user) => {
        if (err) {
          console.error(err);
          res.status(500)
            .json(utils.generateErrMsg(req, err));
        } else {
          if (!user) {
            res.status(404)
              .json(utils.generateErrMsg(req, {
                name: 'UserNotFoundError',
                message: 'The user does not exist!'
              }));
          } else {
            console.log(JSON.stringify(user.localProfile));
            if (user.localProfile) {
              delete user.localProfile.verifyToken;
            }
            res.json(user);
          }
        }
      });
  });

userRouter.put('/:id/name', utils.verify, (req, res, next) => {
  Users.findById(req.params.id)
    .exec((err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json(utils.generateErrMsg(req, err));
      }
      if (!user) {
        err = new Error('User not found!');
        err.name = 'UserNotFoundError';
        return res.status(404).json(utils.generateErrMsg(req, err));
      }
      if (req.body.displayName) {
        // Change user's name
        user.localProfile.displayName = req.body.displayName;
        user.save((err, user) => {
          console.log(JSON.stringify(user));
          if (err) {
            console.error(err);
            return res.status(500).json(utils.generateErrMsg(req, err));
          }
          return res.status(200).json({
            _id: user._id,
            email: user.email,
            localProfile: user.localProfile,
            facebookProfile: user.facebookProfile,
            googleProfile: user.googleProfile,
            verified: user.verified
          });
        });
      }
    });
});

userRouter.put('/:id/password', utils.verify, (req, res, next) => {
  Users.findById(req.params.id)
    .exec()
    .then(user => {
      if (!user) {
        const err = new Error('User is not found!');
        err.name = 'UserNotFoundError';
        console.error(err);
        res.status(404).json(utils.generateErrMsg(req, err));
      } else {
        return authenticatePassword(user, req.body.originalPassword);
      }
    })
    .then(user => {
      if (!user) {
        const err = new Error('User is not found!');
        err.name = 'UserNotFoundError';
        console.error(err);
        res.status(404).json(utils.generateErrMsg(req, err));
      } else {
        return setPassword(user, req.body.password);
      }
    })
    .then(user => user.save())
    .then(() => {
      res.status(200).json({
        status: 'Password Changed. Please Log out',
        success: true
      })
    })
    .catch(err => {
      console.error(err);
      res.status(500).json(utils.generateErrMsg(req, err));
    });
});

userRouter.route('/:id/facebook')
  .post(utils.verify, (req, res, next) => {
    Users.findById(req.params.id)
      .exec()
      .then(user => {
        if (!user) {
          const err = new Error('User does not exist');
          err.name = 'UserNotFoundError';
          return res.status(404)
            .json(utils.generateErrMsg(req, err));
        } else {
          passport.authenticate('facebook-token', (err, user, info) => {
            if (err) {
              console.error(err);
              return res.status(500).json(utils.generateErrMsg(req, err));
            } else if (!user) {
              console.error(info);
              err = new Error('Internal Error');
              err.name = 'InternalError';
              return res.status(500).json(utils.generateErrMsg(req, err));
            } else {
              res.status(200).json(user);
            }
          })(req, res, next);
        }
      })
      .catch(err => {
        console.error(err);
        res.status(500).json(utils.generateErrMsg(req, err));
      });
  })
  .delete(utils.verify, (req, res, next) => {
    Users.findById(req.params.id)
      .exec()
      .then(user => {
        if (!user) {
          res.status(404).json(utils.generateErrMsg(req, {
            name: 'UserNotFoundError',
            message: 'User does not exists!'
          }));
        } else {
          user.facebookProfile = undefined;
          user.save()
            .then(user => {
              res.status(200).json({
                status: 'Facebook Profile deleted',
                success: true
              });
            })
            .catch(err => {
              console.error(err);
              res.status(500).json(utils.generateErrMsg(req, err));
            });
        }
      })
      .catch(err => {
        console.error(err);
        res.status(500).json(utils.generateErrMsg(req, err));
      });
  });

userRouter.route('/:id/google')
  .all(utils.verify)
  .post((req, res, next) => {
    Users.findById(req.params.id)
      .exec()
      .then(user => {
        if (!user) {
          const err = new Error('User does not exists!');
          err.name = 'UserNotFoundError';
          res.status(404).json(utils.generateErrMsg(req, err));
        } else {
          googleAuthenticate(req.query.id_token)
            .then(googleUser => {
              user.googleProfile = {
                email: googleUser.email,
                googleId: googleUser.sub,
                displayName: googleUser.given_name + ' ' + googleUser.family_name,
                imageUrl: googleUser.picture,
              };
              return user.save();
            })
            .then(user => {
              res.status(200).json({
                email: user.email,
                hasLocalProfile: user.hasLocalProfile,
                googleProfile: user.googleProfile,
                facebookProfile: user.facebookProfile,
                localProfile: user.localProfile,
                verified: user.verified
              });
            })
            .catch(err => {
              console.error(err);
              res.status(500).json(utils.generateErrMsg(req, err));
            });
        }
      })
      .catch(err => {
        console.error(err);
        res.status(500).json(utils.generateErrMsg(req, err));
      })
  })
  .delete((req, res, next) => {
    Users.findById(req.params.id)
      .exec()
      .then(user => {
        if (!user) {
          const err = new Error('User does not exists!');
          err.name = 'UserNotFoundError';
          res.status(404).json(utils.generateErrMsg(req, err));
        } else {
          user.googleProfile = undefined;
          user.save()
            .then(user => {
              if (!user) {
                const err = new Error('User does not exists!');
                err.name = 'UserNotFoundError';
                res.status(404).json(utils.generateErrMsg(req, err));
              } else {
                res.status(200).json({
                  success: true,
                  status: 'Google Profile deleted'
                });
              }
            })
            .catch(err => {
              res.status(500).json(utils.generateErrMsg(req, err));
            });
        }
      })
      .catch(err => {
        res.status(500).json(utils.generateErrMsg(req, err));
      });
  });

userRouter.route('/:id/interested')
  .get(utils.verify, (req, res, next) => {
    Users.findById(req.params.id)
      .exec()
      .then(user => {
        if (!user) {
          return res.status(404).json(util.generateErrMsg(req, new errors.UserNotFoundError()));
        } else {
          return res.status(200).json(user.interested ? user.interested : []);
        }
      })
      .catch(err => {
        res.status(500).json(utils.generateErrMsg(req, err));
      });
  })
  .post(utils.verify, (req, res, next) => {
    Rx.Observable.fromPromise(Users.findById(req.params.id).exec())
      .flatMap(user => {
        if (user) {
          user.interested.remove(req.body.eventId);
          return Rx.Observable.fromPromise(user.save());
        } else {
          return Rx.Observable.throw(new errors.UserNotFoundError())
        }
      })
      .subscribe({
        next: user => res.status(200).json(user),
        error: err => res.status(err.status ? err.status : 500).json(utils.generateErrMsg(req, err))
      });
  });

userRouter.route('/:id/uninterested')
  .get(utils.verify, (req, res, next) => {
    Rx.Observable.fromPromise(Users.findById(req.params.id).exec())
      .subscribe({
        next: user => {
          if (!user) {
            return res.status(404).json(utils.generateErrMsg(req, new errors.UserNotFoundError()));
          } else {
            return res.status(200).json(user.uninterested ? user.uninterested : []);
          }
        },
        error: err => {
          res.status(500).json(utils.generateErrMsg(req, err));
        }
      });
  })
  .post(utils.verify, (req, res, next) => {
    Rx.Observable.fromPromise(Users.findById(req.params.id).exec())
      .flatMap(user => {
        if (user) {
          user.uninterested.remove(req.body.eventId);
          return Rx.Observable.fromPromise(user.save());
        } else {
          return Rx.Observable.throw(new errors.UserNotFoundError())
        }
      })
      .subscribe({
        next: user => res.status(200).json(user),
        error: err => res.status(err.status ? err.status : 500).json(utils.generateErrMsg(req, err))
      });
  });

userRouter.post('/:id/upload',
  utils.verify,
  imageUpload.single('image'),
  (req, res, next) => {
    Users.findById(req.params.id)
      .exec()
      .then(user => {
        user.localProfile = user.localProfile || {};
        user.localProfile.imageUrl = config.apiEntrance + `users/${req.params.id}/image`;
        console.log(user.localProfile.imageUrl);
        return user.save();
      })
      .then(user => {
        res.status(200).json(user);
      })
      .catch(err => {
        next(err);
      });
  });

userRouter.get('/:id/image', utils.verify, (req, res, next) => {
  const imageExts = ['.png', '.jpg', '.gif', '.tiff', '.jpeg', '.tif'];
  console.log(__dirname);
  for (ext of imageExts) {
    const filePath = path.resolve(__dirname + `/../userImages/${(req.params.id + ext).toLowerCase()}`);
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (err) {
      console.log(filePath + ' not found');
      continue;
    }
    return res.sendFile(filePath);
  }
  const err = new Error('File not found!');
  err.status = 404;
  next(err);
});

function loginUser(req, res, user) {
  req.logIn(user, (err) => {
    if (err) {
      console.log('Error after calling req.logIn');
      console.error(err);
      return res.status(500)
        .json(utils.generateErrMsg(req, err));
    }
    console.log('login successfully!');
    console.log(JSON.stringify(user, null, 2));
    const token = utils.getToken(user);
    res.status(200).json(utils.loginResponse(user, token));
  });
}

function registerUser(req, res, tempUserInfo) {
  Users.register(new Users({ email: req.body.email }),  // register the user
    req.body.password, (err, user) => {
      if (err) {
        console.error(err);
        if (err.name === 'UserExistsError') {
          return res.status(409)
            .json(utils.generateErrMsg(req, err));
        }
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      }
      user.localProfile.displayName = req.body.name;
      if (tempUserInfo) {
        if (tempUserInfo.facebookProfile) {
          user.facebookProfile = JSON.parse(JSON.stringify(tempUserInfo.facebookProfile));
        }
        if (tempUserInfo.googleProfile) {
          user.googleProfile = JSON.parse(JSON.stringify(tempUserInfo.googleProfile));
        }
      }
      user.save((err, user) => {
        if (err) {
          console.error(err);
          return res.status(500)
            .json(utils.generateErrMsg(req, err));
        }
        const verifyToken = utils.generateVerifyToken(user);  // generate token for verification
        user.localProfile.verifyToken = verifyToken;
        user.hasLocalProfile = true;
        user.save((err, user) => {  // keep the verifyToken for later use
          if (err) {
            console.error(err);
            return res.status(500)
              .json(utils.generateErrMsg(req, err));
          }
          // send verify email
          const verifyUrl = config.apiEntrance + 'users/verify?verify_token=' + verifyToken;

          // TODO enable sending email function when push to GitHub
          Mailer.sendEmail(user.email, verifyUrl,
            (err, info) => {
              if (err) {
                console.error(err);
                return res.status(500)
                  .json(utils.generateErrMsg(req, err));
              }
              // send the verify url to the client
              res.status(200).json({
                success: true,
                url: verifyUrl
              });
            });
          // send the verify url to the client
          // res.status(200).json({
          //   success: true,
          //   url: verifyUrl
          // });
        });
      });
    });
}

function setPassword(user, password) {
  return new Promise((resolve, reject) => {
    console.log(typeof password);
    user.setPassword(password, (setPasswordErr, user) => {
      if (setPasswordErr) {
        return reject(setPasswordErr);
      }
      resolve(user);
    });
  });
}

function authenticatePassword(user, password) {
  return new Promise((resolve, reject) => {
    console.log(typeof password);
    user.authenticate(password, (err, thisModel, passwordErr) => {
      if (err) {
        return reject(err);
      }
      if (passwordErr) {
        return reject(passwordErr);
      }
      resolve(thisModel);
    });
  });
}

function googleAuthenticate(idToken) {
  return new Promise((resolve, reject) => {
    const googleTokenInfoUrl = 'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=';
    request.get(googleTokenInfoUrl + idToken, (err, response, body) => {
      if (err)
        return reject(err);
      console.log('Response from Google: ' + body);
      body = JSON.parse(body);
      resolve(body);
    });
  });
}

module.exports = userRouter;
