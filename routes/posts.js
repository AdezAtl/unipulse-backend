const express = require('express');
const { protect } = require('../middleware/auth');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

const router = express.Router();

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, tags } = req.query;
    
    let query = { isPublic: true };
    
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }
    
    if (tags) {
      query.tags = { $in: tags.split(',') };
    }
    
    const posts = await Post.find(query)
      .populate('author', 'name avatar')
      .populate('comments.user', 'name avatar')
      .populate('likes', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments(query);

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

// @desc    Create post
// @route   POST /api/posts
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    req.body.author = req.user.id;
    const post = await Post.create(req.body);
    await post.populate('author', 'name avatar');
    
    res.status(201).json({ success: true, post });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Like/unlike post
// @route   POST /api/posts/:id/like
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    const hasLiked = post.likes.includes(req.user.id);
    
    if (hasLiked) {
      // Unlike
      post.likes = post.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Like
      post.likes.push(req.user.id);
      
      // Create notification if not the author
      if (post.author.toString() !== req.user.id) {
        await Notification.create({
          recipient: post.author,
          sender: req.user.id,
          type: 'like',
          title: 'New Like',
          message: `${req.user.name} liked your post`,
          relatedEntity: { type: 'post', id: post._id }
        });
        
        // Send real-time notification
        const io = req.app.get('io');
        io.to(post.author.toString()).emit('notification', {
          type: 'like',
          message: `${req.user.name} liked your post`
        });
      }
    }
    
    await post.save();
    await post.populate('likes', 'name avatar');
    
    res.json({ 
      success: true, 
      liked: !hasLiked,
      likesCount: post.likes.length 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Private
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { content } = req.body;
    
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    post.comments.push({
      user: req.user.id,
      content
    });
    
    await post.save();
    await post.populate('comments.user', 'name avatar');
    
    // Create notification if not the author
    if (post.author.toString() !== req.user.id) {
      await Notification.create({
        recipient: post.author,
        sender: req.user.id,
        type: 'comment',
        title: 'New Comment',
        message: `${req.user.name} commented on your post`,
        relatedEntity: { type: 'post', id: post._id }
      });
      
      // Send real-time notification
      const io = req.app.get('io');
      io.to(post.author.toString()).emit('notification', {
        type: 'comment',
        message: `${req.user.name} commented on your post`
      });
    }
    
    res.json({ success: true, comments: post.comments });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private (Author or Admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    // Check if user is author or admin
    if (post.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this post' 
      });
    }
    
    await Post.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;