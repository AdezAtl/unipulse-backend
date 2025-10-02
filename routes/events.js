const express = require('express');
const {
  getEvents,
  createEvent,
  rsvpEvent
} = require('../controllers/events');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getEvents);
router.post('/', protect, authorize('admin', 'moderator'), createEvent);
router.post('/:id/rsvp', protect, rsvpEvent);

module.exports = router;