// routes/index.js

const express = require('express');
const router = express.Router();

// @route   GET api/
// @desc    Test API endpoint
// @access  Public
router.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

module.exports = router;
