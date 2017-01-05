const express = require('express');
const userRouter = express.Router();
const passport = require('passport');
const Users = require('../models/users');
const utils = require('../utils');
const config = require('../config.json');
const database = require('../database');
const request = require('request');

userRouter.post('/register', (req, res) => {
  Users.register(new Users({email: req.body.email}),
    req.body.password, (err, user) => {
      if (err) {
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      }
      user.save((err, user) => {
        if (err) {
          return res.status(500)
            .json(utils.generateErrMsg(req, err));
        }
        passport.authenticate('local')(req, res, () => {
          return res.status(200).json({status: `${req.body.email} is registered!`});
        });
      });
    });
});

userRouter.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401)
        .json(utils.generateErrMsg(req, err));
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      }
      const token = utils.getToken(user);
      res.status(200).json(utils.loginResponse(user, token));
    });
  })(req, res, next);
});

userRouter.get('/logout', (req, res) => {
  req.logOut();
  res.status(200).json({status: 'Bye!'});
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
      email: body.email,
      googleId: body.sub
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

userRouter.route('/:id/likes')
  .get(utils.verify, (req, res, next) => {
    res.json({
      events: ['will', 'send', 'user', req.params.id, 'liked', 'events']
    })
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

module.exports = userRouter;
