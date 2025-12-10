const express = require('express');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');
const router = express.Router();

// Get messages for a chat
router.get('/chat/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    // Check if user is part of this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const userId = req.user._id;
    if (chat.user1Id.toString() !== userId.toString() && 
        chat.user2Id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Build query
    const query = { chatId };
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // Get messages
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('senderId', 'nickname avatar');

    // Mark messages as read (only received messages)
    const receivedMessages = messages.filter(msg => 
      msg.senderId._id.toString() !== userId.toString() && !msg.read
    );

    if (receivedMessages.length > 0) {
      await Message.updateMany(
        { 
          _id: { $in: receivedMessages.map(msg => msg._id) },
          read: false 
        },
        { $set: { read: true } }
      );
    }

    // Format response
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      chatId: msg.chatId,
      senderId: msg.senderId._id,
      senderName: msg.senderId.nickname,
      senderAvatar: msg.senderId.avatar,
      text: msg.text,
      timestamp: msg.timestamp,
      read: msg.read || msg.senderId._id.toString() === userId.toString()
    })).reverse(); // Reverse to get chronological order

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message (for REST API, Socket.IO is preferred)
router.post('/', auth, async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const senderId = req.user._id;

    // Check if user is part of this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (chat.user1Id.toString() !== senderId.toString() && 
        chat.user2Id.toString() !== senderId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create message
    const message = new Message({
      chatId,
      senderId,
      text,
      timestamp: new Date()
    });

    await message.save();

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: text,
      lastMessageTime: new Date()
    });

    // Populate sender info
    await message.populate('senderId', 'nickname avatar');

    // Format response
    const formattedMessage = {
      _id: message._id,
      chatId: message.chatId,
      senderId: message.senderId._id,
      senderName: message.senderId.nickname,
      senderAvatar: message.senderId.avatar,
      text: message.text,
      timestamp: message.timestamp,
      read: message.read
    };

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark message as read
router.put('/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is part of this chat
    const chat = await Chat.findById(message.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const userId = req.user._id;
    if (chat.user1Id.toString() !== userId.toString() && 
        chat.user2Id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only mark as read if user is not the sender
    if (message.senderId.toString() !== userId.toString()) {
      message.read = true;
      await message.save();
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;