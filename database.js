const mongoose = require('mongoose');
const url = require('url');
const Events = require('./models/events');
const Users = require('./models/users');

const mongoDbUrl = 'mongodb://localhost:27017/excited';
const db = mongoose.connection;

// configure db
db.on('error', console.error.bind(console, 'Connection Error: '));

exports.connect = (callback) => {
  mongoose.connect(mongoDbUrl);
  db.once('open', () => {
    console.log('Connected to MongoDB');
    callback();
    // repeat every day
    setInterval(callback, 24 * 60 * 60 * 1000);
  });
};

exports.save = (events) => {
  events.forEach((event) => {
    Events.findOneAndUpdate(
      {url: event.url},
      event,
      {upsert: true},
      (err) => {
        if (err) {
          console.error('Updating Error: ', err);
        }
      });
  });
  removeOutdatedEvents();
  setInterval(removeOutdatedEvents, 24 * 60 * 60 * 1000);
};

exports.saveUser = (user, callback) => {
  let email = null;
  if (!user) {
    return callback(new Error('User is not provided!'));
  }
  if (user.email)
    email = user.email;
  else if (user.facebookProfile && user.facebookProfile.email)
    email = user.facebookProfile.email;
  else if (user.googleProfile && user.googleProfile.email)
    email = user.googleProfile.email;
  if (!email) {
    return callback(new Error('Email is not provided!'));
  }
  Users.findOne({email: email})
    .exec((err, userFound) => {
      if (err) {
        return callback(err);
      }
      if (!userFound) {
        user.email = (user.facebookProfile ? user.facebookProfile.email : user.googleProfile.email);
        const newUser = new Users(user);
        newUser.save((err, user) => {
          if (err) {
            return callback(err);
          } else {
            return callback(null, user);
          }
        });
      } else {
        if (user.facebookProfile) {
          userFound.facebookProfile = JSON.parse(JSON.stringify(user.facebookProfile))
        } else if (user.googleProfile) {
          userFound.googleProfile = JSON.parse(JSON.stringify(user.googleProfile));
        }
        userFound.save((err, user) => {
          if (err) {
            return callback(err);
          } else {
            return callback(null, user);
          }
        });
      }
    });
};

function removeOutdatedEvents() {
  Events.remove({endDate: {$lte: Date.now()}})
    .exec((err, event) => {
      if (err) {
        console.error('RemoveOutdatedEventsError', err);
      } else {
        console.log('Removed Outdated Events')
      }
    });
}