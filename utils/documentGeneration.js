const OpenAI = require('openai');
const promptSamples = require('./promptSamples.json');
const { AI_MODELS } = require('./aiModels');
// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const aiModel = AI_MODELS.gpt4o;
async function generateDocumentContent(projectName, projectDetails) {
  console.log('Generating document content for project:', projectName);

  // Step 1: Generate content for each section from promptSamples.json
  const sectionContents = await generateSectionContents(
    projectName,
    projectDetails
  );

  // Step 2: Aggregate all sections into a JSON object
  const documentContent = {
    projectName,
    sections: sectionContents,
  };

  console.log(
    'Generated document content:',
    JSON.stringify(documentContent, null, 2)
  );

  return documentContent;
}

async function generateSectionContents(projectName, projectDetails) {
  const sectionContents = {};

  for (const [sectionName, sectionData] of Object.entries(promptSamples)) {
    console.log(`Generating content for section: ${sectionName}`);
    const sectionContent = await generateSectionContent(
      projectName,
      projectDetails,
      sectionName,
      sectionData
    );
    sectionContents[sectionName] = sectionContent;
  }

  return sectionContents;
}

async function generateSectionContent(
  projectName,
  projectDetails,
  sectionName,
  sectionData
) {
  const {
    'Detailed Prompt': detailedPrompt,
    Steps: steps,
    OutputFormat: outputFormat,
  } = sectionData;

  console.log('Detailed Prompt:', detailedPrompt);
  console.log('Steps:', steps);
  console.log('OutputFormat:', outputFormat);
  // console.log('SectionData:', sectionData);
  const prompt = `
Project Name: ${projectName}
Project Details: ${projectDetails}

${detailedPrompt}

Steps:
${JSON.stringify(steps, null, 2)}

Please generate content for the "${sectionName}" section based on the above information and steps. Follow the output format: ${outputFormat}
`;

  const response = await openai.chat.completions.create({
    model: aiModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  // console.log('Prompt: ', prompt);
  console.log(`Received response from OpenAI for section: ${sectionName}`);
  const content = response.choices[0].message.content;

  // If the content is too long, split it into multiple subsections
  const subsections = splitIntoSubsections(content);

  // Merge subsections back into one content
  const mergedContent = subsections.join('\n\n');

  return mergedContent;
}

function splitIntoSubsections(content, maxLength = 2000) {
  const subsections = [];
  let currentSubsection = '';

  content.split('\n').forEach((line) => {
    if (currentSubsection.length + line.length > maxLength) {
      subsections.push(currentSubsection.trim());
      currentSubsection = '';
    }
    currentSubsection += line + '\n';
  });

  if (currentSubsection.trim()) {
    subsections.push(currentSubsection.trim());
  }

  return subsections;
}

async function updateSectionContent(
  sectionName,
  currentContent,
  updateInstructions
) {
  console.log(`Updating content for section: ${sectionName}`);
  const updateResponse = await openai.chat.completions.create({
    model: aiModel,
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

async function createDocumentVersion(documentId, content, userId) {
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const latestVersion = await DocumentVersion.findOne({
      document: documentId,
    })
      .sort('-versionNumber')
      .exec();

    const newVersionNumber = latestVersion
      ? latestVersion.versionNumber + 1
      : 1;

    const newVersion = new DocumentVersion({
      document: documentId,
      versionNumber: newVersionNumber,
      content: content,
      createdBy: userId,
    });

    await newVersion.save();
    return newVersion;
  } catch (error) {
    console.error('Error creating document version:', error);
    throw error;
  }
}

// Export the new function
module.exports = {
  generateDocumentContent,
  updateSectionContent,
  createDocumentVersion,
};
