// routes/protected.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET /api/protected
// @desc    Test protected route
// @access  Private
router.get('/', auth, (req, res) => {
  res.json({ msg: `Hello, user ${req.user.id} with role ${req.user.role}` });
});

module.exports = router;
