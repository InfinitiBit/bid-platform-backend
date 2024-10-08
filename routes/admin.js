// routes/admin.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');

// Middleware to check for Admin role
const requireAdmin = [auth, role(['Admin'])];

// @route   GET /api/admin/users
// @desc    Get list of all users (Admin only)
// @access  Private
router.get('/users', auth, role(['Admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude passwords
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude passwords
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin only)
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid user ID' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/users/:id
// @desc    Update user details
// @access  Private (Admin only)
router.put(
  '/users/:id',
  requireAdmin,
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please include a valid email'),
    body('role')
      .optional()
      .isIn(['Admin', 'Bid Creator', 'Team Lead', 'Dep Head'])
      .withMessage('Invalid role'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, role } = req.body;

    // Build user object
    const userFields = {};
    if (name) userFields.name = name;
    if (email) userFields.email = email;
    if (role) userFields.role = role;

    try {
      let user = await User.findById(req.params.id);

      if (!user) return res.status(404).json({ msg: 'User not found' });

      // Check if email is being updated to an existing email
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ msg: 'Email already in use' });
        }
      }

      user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: userFields },
        { new: true }
      ).select('-password'); // Exclude password

      res.json(user);
    } catch (err) {
      console.error(err.message);
      // Handle invalid ObjectId
      if (err.kind === 'ObjectId') {
        return res.status(400).json({ msg: 'Invalid user ID' });
      }
      res.status(500).send('Server error');
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Private (Admin only)
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    await User.findByIdAndRemove(req.params.id);

    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error(err.message);
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid user ID' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;
