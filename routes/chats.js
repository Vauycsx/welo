const express = require('express');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const chats = await Chat.find({
      $or: [{ user1Id: userId }, { user2Id: userId }]
    })
    .populate('user1Id', 'nickname username avatar isOnline')
    .populate('user2Id', 'nickname username avatar isOnline')
    .sort({ lastMessageTime: -1, createdAt: -1 });

    // Format response
    const formattedChats = chats.map(chat => {
      const otherUser = chat.user1Id._id.toString() === userId.toString() 
        ? chat.user2Id 
        : chat.user1Id;
      
      return {
        _id: chat._id,
        otherUser: {
          _id: otherUser._id,
          nickname: otherUser.nickname,
          username: otherUser.username,
          avatar: otherUser.avatar,
          isOnline: otherUser.isOnline
        },
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        createdAt: chat.createdAt
      };
    });

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or get chat with user
router.post('/start/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    // Check if chat already exists
    let chat = await Chat.findOne({
      $or: [
        { user1Id: currentUserId, user2Id: otherUserId },
        { user1Id: otherUserId, user2Id: currentUserId }
      ]
    })
    .populate('user1Id', 'nickname username avatar isOnline')
    .populate('user2Id', 'nickname username avatar isOnline');

    // If chat doesn't exist, create it
    if (!chat) {
      // Check other user's privacy settings
      const otherUser = await User.findById(otherUserId);
      
      if (otherUser.settings.messagePrivacy === 'contacts') {
        // User only accepts messages from contacts
        // Since no chat exists, they're not contacts
        return res.status(403).json({ 
          message: 'This user only accepts messages from contacts' 
        });
      }

      chat = new Chat({
        user1Id: currentUserId,
        user2Id: otherUserId
      });

      await chat.save();
      
      // Populate user data
      chat = await Chat.findById(chat._id)
        .populate('user1Id', 'nickname username avatar isOnline')
        .populate('user2Id', 'nickname username avatar isOnline');
    }

    // Format response
    const otherUser = chat.user1Id._id.toString() === currentUserId.toString() 
      ? chat.user2Id 
      : chat.user1Id;
    
    const formattedChat = {
      _id: chat._id,
      otherUser: {
        _id: otherUser._id,
        nickname: otherUser.nickname,
        username: otherUser.username,
        avatar: otherUser.avatar,
        isOnline: otherUser.isOnline
      },
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime,
      createdAt: chat.createdAt
    };

    res.json({ chat: formattedChat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat by ID
router.get('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .populate('user1Id', 'nickname username avatar isOnline')
      .populate('user2Id', 'nickname username avatar isOnline');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is part of this chat
    const userId = req.user._id;
    if (chat.user1Id._id.toString() !== userId.toString() && 
        chat.user2Id._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Format response
    const otherUser = chat.user1Id._id.toString() === userId.toString() 
      ? chat.user2Id 
      : chat.user1Id;
    
    const formattedChat = {
      _id: chat._id,
      otherUser: {
        _id: otherUser._id,
        nickname: otherUser.nickname,
        username: otherUser.username,
        avatar: otherUser.avatar,
        isOnline: otherUser.isOnline
      },
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime,
      createdAt: chat.createdAt
    };

    res.json({ chat: formattedChat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;