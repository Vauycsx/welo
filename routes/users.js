const express = require('express');
const User = require('../models/User');
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');
const router = express.Router();

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const currentUser = req.user;
    
    // Search by username or nickname
    const users = await User.find({
      _id: { $ne: currentUser._id },
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { nickname: { $regex: query, $options: 'i' } }
      ]
    }).select('-password');

    // Filter by privacy settings
    const filteredUsers = users.filter(user => {
      if (user.settings.discoverability === 'nobody') return false;
      if (user.settings.discoverability === 'contacts') {
        // Check if they have a chat (are contacts)
        return Chat.exists({
          $or: [
            { user1Id: currentUser._id, user2Id: user._id },
            { user1Id: user._id, user2Id: currentUser._id }
          ]
        });
      }
      return true;
    });

    res.json({ users: filteredUsers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { nickname, avatar, settings } = req.body;
    const user = req.user;

    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    if (settings) user.settings = { ...user.settings, ...settings };

    await user.save();

    res.json({ 
      message: 'Profile updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Check current password
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;