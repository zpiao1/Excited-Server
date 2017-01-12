const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: String,
  facebookId: String,
  googleId: String,
  imageUrl: String,
  displayName: String,
  verified: {
    type: Boolean,
    default: false
  },
  verifyToken: {
    type: String,
    default: null
  }
}, {timeStamps: true});

userSchema.plugin(passportLocalMongoose, {
  usernameField: 'email'
});
const Users = mongoose.model('user', userSchema);
module.exports = Users;