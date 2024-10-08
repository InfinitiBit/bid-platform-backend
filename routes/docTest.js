// routes/docTest.js

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// @route   POST /api/docTest
// @desc    Test endpoint with OpenAI API call using POST method
// @access  Public
router.post('/', async (req, res) => {
  try {
    console.log('Received POST request to /api/docTest');

    // Get data from the request body
    const { message } = req.body;

    if (!message) {
      return res
        .status(400)
        .json({ msg: 'Message is required in the request body.' });
    }

    console.log('Received message:', message);

    // Make a simple OpenAI API call using the message from the request body
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const aiResponse = response.choices[0].message.content;
    console.log('OpenAI API response:', aiResponse);

    res.json({
      msg: 'docTest endpoint with OpenAI API call (POST method)',
      aiResponse,
    });
  } catch (err) {
    console.error('Error in /api/docTest:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
