const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route   GET /api/notifications
// @desc    Get all notifications for the authenticated user
// @access  Private (All authenticated users)
router.get('/', auth, async (req, res) => {
  console.log('Fetching notifications for user:', req.user.id);
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('document', 'name')
      .populate('user', 'name');

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/notifications/:id
// @desc    Mark a notification as read
// @access  Private (All authenticated users)
router.put('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    console.error('Error updating notification:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private (All authenticated users)
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    await notification.remove();

    res.json({ msg: 'Notification removed' });
  } catch (err) {
    console.error('Error deleting notification:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
