const OpenAI = require('openai');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateDocumentContent(projectName, projectDetails) {
  console.log('Generating document content for project:', projectName);

  // Step 1: Get project summary and sections
  const summaryData = await getProjectSummaryAndSections(
    projectName,
    projectDetails
  );

  // Step 2: Generate content for each section
  const sectionContents = await generateSectionContents(
    projectName,
    summaryData.summary,
    projectDetails,
    summaryData.sections
  );

  // Step 3: Aggregate all sections into a JSON object
  const documentContent = {
    projectName,
    summary: summaryData.summary,
    sections: sectionContents,
  };

  console.log(
    'Generated document content:',
    JSON.stringify(documentContent, null, 2)
  );

  return documentContent;
}

async function getProjectSummaryAndSections(projectName, projectDetails) {
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

  if (
    !summaryData.summary ||
    !summaryData.sections ||
    !Array.isArray(summaryData.sections)
  ) {
    console.error('Invalid response format from OpenAI for summary.');
    throw new Error('Invalid response format from OpenAI for summary.');
  }

  return summaryData;
}

async function generateSectionContents(
  projectName,
  summary,
  projectDetails,
  sections
) {
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

  return sectionContents;
}

async function updateSectionContent(
  sectionName,
  currentContent,
  updateInstructions
) {
  console.log(`Updating content for section: ${sectionName}`);
  const updateResponse = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content:
          'You are an AI assistant that helps update document sections based on user instructions.',
      },
      {
        role: 'user',
        content: `Please update the following section content based on the given instructions:

Section Name: ${sectionName}

Current Content:
${currentContent}

Update Instructions:
${updateInstructions}

Please provide the updated content for the section.`,
      },
    ],
    temperature: 0.7,
  });

  console.log(
    `Received response from OpenAI for section update: ${sectionName}`
  );
  const updatedContent = updateResponse.choices[0].message.content;
  console.log(`Updated content for "${sectionName}":`, updatedContent);

  return updatedContent;
}

module.exports = {
  generateDocumentContent,
  updateSectionContent,
};
