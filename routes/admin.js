const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post');
const Event = require('../models/Event');

const router = express.Router();

// Protect all admin routes
router.use(protect);
router.use(authorize('admin', 'moderator'));

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private (Admin/Moderator)
router.get('/stats', async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    const postsCount = await Post.countDocuments();
    const eventsCount = await Event.countDocuments();
    const activeUsers = await User.countDocuments({ 
      lastActive: { $gte: new Date(Date.now() - 24*60*60*1000) } 
    });
    
    // Recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');
    
    const recentPosts = await Post.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('content author createdAt');
    
    res.json({
      success: true,
      stats: {
        users: usersCount,
        posts: postsCount,
        events: eventsCount,
        activeUsers
      },
      recentActivity: {
        users: recentUsers,
        posts: recentPosts
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all users (admin view)
// @route   GET /api/admin/users
// @access  Private (Admin/Moderator)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      query.role = role;
    }
    
    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      users
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin only)
router.put('/users/:id/role', authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all posts for moderation
// @route   GET /api/admin/posts
// @access  Private (Admin/Moderator)
router.get('/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const posts = await Post.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments();

    res.json({
      success: true,
      count: posts.length,
      total,
      pages: Math.ceil(total / limit),
      posts
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Delete any post (admin power)
// @route   DELETE /api/admin/posts/:id
// @access  Private (Admin/Moderator)
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;