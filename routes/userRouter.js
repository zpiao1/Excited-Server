const express = require('express');
const userRouter = express.Router();
const passport = require('passport');
const User = require('../models/users');
const utils = require('../utils');

userRouter.post('/register', (req, res) => {
  User.register(new User({email: req.body.email}),
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
      return res.status(401).json({
        method: '/users/login POST',
        err: info
      });
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      }
      const token = utils.getToken(user);
      res.status(200).json({
        status: 'Login successful!',
        success: true,
        token: token
      });
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
      res.status(200).json({
        status: 'Login successful!',
        success: true,
        token: token
      });
    });
  })(req, res, next);
});

module.exports = userRouter;