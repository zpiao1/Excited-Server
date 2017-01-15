const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const FacebookTokenStrategy = require('passport-facebook-token');
const Users = require('./models/users');
const config = require('./config.json');
const database = require('./database');

exports.local = passport.use(Users.createStrategy());
passport.serializeUser(Users.serializeUser());
passport.deserializeUser(Users.deserializeUser());

exports.facebook = passport.use(new FacebookTokenStrategy({
  clientID: config.facebookAppId,
  clientSecret: config.facebookAppSecret
}, (accessToken, refreshToken, profile, done) => {
  console.log('accessToken: ' + accessToken);
  const user = {
    facebookProfile: {
      email: profile.emails[0].value,
      facebookId: profile.id,
      imageUrl: profile.photos[0].value,
      displayName: profile.displayName
    },
    verified: true
  };
  database.saveUser(user, (err, usr) => {
    if (err) {
      console.error('Error in saving facebook user: ' + JSON.stringify(user));
      console.error(err);
    } else {
      done(null, usr);
    }
  });
}));