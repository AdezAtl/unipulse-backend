const Event = require('../models/Event');
const Notification = require('../models/Notification');

// @desc    Get all events
// @route   GET /api/events
// @access  Public
exports.getEvents = async (req, res) => {
  try {
    const { category, page = 1, limit = 10, search } = req.query;
    
    let query = { isCancelled: false };
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const events = await Event.find(query)
      .populate('organizer', 'name avatar')
      .populate('attendees.user', 'name avatar')
      .sort({ date: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      count: events.length,
      total,
      pages: Math.ceil(total / limit),
      events
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create event
// @route   POST /api/events
// @access  Private (Admin/Moderator)
exports.createEvent = async (req, res) => {
  try {
    req.body.organizer = req.user.id;
    const event = await Event.create(req.body);

    // Populate organizer info
    await event.populate('organizer', 'name avatar');

    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    RSVP to event
// @route   POST /api/events/:id/rsvp
// @access  Private
exports.rsvpEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const { status } = req.body;
    const userId = req.user.id;

    // Remove existing RSVP
    event.attendees = event.attendees.filter(
      attendee => attendee.user.toString() !== userId
    );

    // Add new RSVP
    event.attendees.push({
      user: userId,
      status: status || 'interested'
    });

    await event.save();
    await event.populate('attendees.user', 'name avatar');

    res.json({
      success: true,
      event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};