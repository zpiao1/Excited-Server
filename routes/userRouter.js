const express = require('express');
const userRouter = express.Router();
const passport = require('passport');
const Users = require('../models/users');
const utils = require('../utils');
const config = require('../config.json');
const database = require('../database');
const request = require('request');
const Mailer = require('../nodemailer');

userRouter.post('/register', (req, res) => {
  Users.findOne({email: req.body.email})
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
        Users.remove({email: req.body.email})
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
  const googleTokenInfoUrl = 'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=';
  request.get(googleTokenInfoUrl + req.query.id_token, (err, response, body) => {
    console.log('Response from Google: ' + body);
    body = JSON.parse(body);
    const resUser = { // response user from Google authentications
      googleProfile: {
        email: body.email,
        googleId: body.sub,
        displayName: body.given_name + ' ' + body.family_name,
        imageUrl: body.picture,
      },
      verified: true
    };
    database.saveUser(resUser, (err, user) => {
      if (err) {
        console.error('Error in saving facebook user: ' + JSON.stringify(resUser));
        console.error(err);
      } else {
        loginUser(req, res, user);
      }
    });
  });
});

userRouter.get('/verify', (req, res) => {
  const verifyToken = req.query.verify_token;
  if (!verifyToken) {
    return res.status(404).end('<h1>No verification token</h1>');
  }
  const user = utils.decryptVerifyToken(verifyToken);
  Users.findOne({_id: user._id, email: user.email})
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
        googleProfile: 1
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

userRouter.route('/:id/likes')
  .get(utils.verify, (req, res, next) => {
    res.json({
      events: ['will', 'send', 'user', req.params.id, 'liked', 'events']
    });
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
  Users.register(new Users({email: req.body.email}),  // register the user
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

module.exports = userRouter;
