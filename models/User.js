const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  nickname: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: 'user'
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  settings: {
    theme: {
      type: String,
      default: 'light'
    },
    textSize: {
      type: Number,
      default: 16
    },
    compactMode: {
      type: Boolean,
      default: false
    },
    discoverability: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone'
    },
    messagePrivacy: {
      type: String,
      enum: ['everyone', 'contacts'],
      default: 'everyone'
    },
    readReceipts: {
      type: Boolean,
      default: true
    },
    onlineStatus: {
      type: Boolean,
      default: true
    }
  }
});

// Remove password when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);