// testOpenAI.js

const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

(async () => {
  try {
    console.log('Testing OpenAI API call...');

    // Make a simple API call to get a completion
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content:
            'Provide a brief summary of a project that creates an AI-powered bid platform.',
        },
      ],
      temperature: 0.7,
    });

    // Log the response content
    const aiResponse = response.choices[0].message.content;
    console.log('OpenAI API response:', aiResponse);
  } catch (err) {
    console.error('Error calling OpenAI API:', err.message);
  }
})();
