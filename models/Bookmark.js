const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  userBookmarked: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['post', 'event', 'user'],
    required: true
  }
}, {
  timestamps: true
});

bookmarkSchema.index({ user: 1, post: 1, event: 1, userBookmarked: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);