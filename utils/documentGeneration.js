const OpenAI = require('openai');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateDocumentContent(projectName, projectDetails) {
  console.log('Calling OpenAI API for project summary and sections...');
  const summaryResponse = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: `Summarize the following project and provide suggested sections for a project document. Return the response in JSON format with "summary" and "sections" fields.

Project Name: ${projectName}
Project Details: ${projectDetails}`,
      },
    ],
    temperature: 0.7,
  });

  console.log('Received response from OpenAI for summary.');
  const summaryContent = summaryResponse.choices[0].message.content;
  console.log('OpenAI summary response content:', summaryContent);

  // Parse the response as JSON
  let summaryData;
  try {
    summaryData = JSON.parse(summaryContent);
  } catch (err) {
    console.error('Error parsing OpenAI summary response:', err.message);
    throw new Error('Error parsing OpenAI response for summary.');
  }

  const { summary, sections } = summaryData;

  if (!summary || !sections || !Array.isArray(sections)) {
    console.error('Invalid response format from OpenAI for summary.');
    throw new Error('Invalid response format from OpenAI for summary.');
  }

  // Generate content for each section
  const sectionContents = {};
  for (const section of sections) {
    console.log(`Generating content for section: ${section}`);
    const sectionResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Write detailed content for the section titled "${section}" for the following project:

Project Name: ${projectName}
Project Summary: ${summary}
Project Details: ${projectDetails}`,
        },
      ],
      temperature: 0.7,
    });

    console.log(`Received response from OpenAI for section: ${section}`);
    const sectionContent = sectionResponse.choices[0].message.content;
    console.log(`Section content for "${section}":`, sectionContent);

    sectionContents[section] = sectionContent;
  }

  // Aggregate all sections into a JSON object
  const documentContent = {
    projectName,
    summary,
    sections: sectionContents,
  };

  return documentContent;
}

module.exports = { generateDocumentContent };
