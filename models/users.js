const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: String,
  facebookId: String,
  googleId: String
}, {timeStamps: true});

userSchema.plugin(passportLocalMongoose, {
  usernameField: 'email'
});
const Users = mongoose.model('user', userSchema);
module.exports = Users;