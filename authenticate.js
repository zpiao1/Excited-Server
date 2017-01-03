const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const FacebookTokenStrategy = require('passport-facebook-token');
const User = require('./models/users');
const config = require('./config.json');

exports.local = passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

exports.facebook = passport.use(new FacebookTokenStrategy({
  clientID: config.facebookAppId,
  clientSecret: config.facebookAppSecret
}, (accessToken, refreshToken, profile, done) => {
  User.findOne({facebookId: profile.id}, (err, user) => {
    if (err) {
      return console.error(err);
    }
    console.log('accessToken: ' + accessToken);
    if (user !== null) {
      done(null, user);
    } else {
      // the user does not exist, create one with the provided info
      user = new User({
        email: profile.emails[0].value,
        facebookId: profile.id,
        facebookToken: accessToken
      });
      user.save((err) => {
        if (err) {
          console.error(err);
        } else {
          console.log(`Facebook user: ${profile.id} saved`);
          done(null, user);
        }
      });
    }
  });
}));