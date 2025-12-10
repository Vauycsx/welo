const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/welo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Import models
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Serve static files (for production)
app.use(express.static('../frontend'));

// Socket.IO for real-time messaging
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User goes online
  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.broadcast.emit('user-status-change', { userId, isOnline: true });
  });

  // User goes offline
  socket.on('user-offline', (userId) => {
    onlineUsers.delete(userId);
    socket.broadcast.emit('user-status-change', { userId, isOnline: false });
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const { chatId, senderId, text } = data;
      
      // Save message to database
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

      // Emit to receiver if online
      const chat = await Chat.findById(chatId);
      const receiverId = chat.user1Id.toString() === senderId ? chat.user2Id : chat.user1Id;
      
      const receiverSocketId = onlineUsers.get(receiverId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new-message', {
          chatId,
          message: {
            _id: message._id,
            senderId,
            text,
            timestamp: message.timestamp,
            read: false
          }
        });
      }

      // Emit back to sender
      socket.emit('message-sent', { chatId, message });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // Mark message as read
  socket.on('mark-read', async ({ messageId, chatId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, { read: true });
      
      // Notify sender if online
      const message = await Message.findById(messageId);
      const senderSocketId = onlineUsers.get(message.senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit('message-read', { messageId, chatId });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  socket.on('disconnect', () => {
    // Find and remove user from online list
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit('user-status-change', { 
          userId, 
          isOnline: false 
        });
        break;
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});