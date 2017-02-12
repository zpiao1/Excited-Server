const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: String,
  verified: {
    type: Boolean,
    default: false
  },
  localProfile: {
    displayName: String,
    imageUrl: String,
    verifyToken: {
      type: String,
      default: null
    }
  },
  facebookProfile: {
    facebookId: String,
    email: String,
    imageUrl: String,
    displayName: String
  },
  googleProfile: {
    googleId: String,
    imageUrl: String,
    displayName: String,
    email: String
  },
  hasLocalProfile: {
    type: Boolean,
    default: false
  },
  interested: [Schema.Types.ObjectId],
  uninterested: [Schema.Types.ObjectId]
}, {timeStamps: true});

userSchema.plugin(passportLocalMongoose, {
  usernameField: 'email'
});
const Users = mongoose.model('user', userSchema);
module.exports = Users;