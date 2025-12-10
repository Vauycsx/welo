const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMessage: {
    type: String,
    default: null
  },
  lastMessageTime: {
    type: Date,
    default: null
  }
});

// Ensure unique chat between two users
chatSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

module.exports = mongoose.model('Chat', chatSchema);