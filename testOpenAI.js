// testOpenAI.js

const OpenAI = require('openai');
require('dotenv').config();

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
    });

    console.log(response.choices[0].message.content);
  } catch (err) {
    console.error('Error with OpenAI API:', err.message);
  }
})();
