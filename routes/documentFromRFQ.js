const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const OpenAI = require('openai');
const Document = require('../models/Document');
const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { AI_MODELS } = require('../utils/aiModels');
const {
  createSharePointFolder,
  uploadFileToSharePoint,
} = require('../utils/sharepointOperations');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { Document: DocxDocument, Packer, Paragraph, TextRun } = require('docx');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Helper function to read file as buffer
const readFileAsBuffer = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
};

// Parse PDF file
const parsePDF = async (filePath) => {
  const dataBuffer = await readFileAsBuffer(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
};

// Parse DOCX file
const parseDOCX = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
};

// Prompt for generating technical proposal
const technicalProposalPrompt = `You are an expert technical writer. Based on the provided Request for Quotation (RFQ), your task is to generate a comprehensive technical proposal for a complex engineering project. The proposal should follow industry standards, ensure precise alignment with the RFQ requirements, and cover all necessary technical aspects, including scope of work, methodology, validation approaches, deliverables, timeline, and any assumptions or limitations.

Instructions:
1. Introduction:
   - Briefly summarize the objectives and purpose of the project as outlined in the RFQ.
   - State the overall aim of the technical proposal and its alignment with the client's expectations.

2. Scope of Work:
   - Provide a detailed breakdown of the work to be done. Ensure that the scope is directly tied to the tasks specified in the RFQ.
   - Include specific tasks, phases of the project, and the systems or components involved (e.g., network reduction, system validation).

3. Methodology:
   - Explain the technical approach for completing each task.
   - Include the software tools, models, or techniques (e.g., DIgSILENT PowerFactory, PSCAD, PSS/E) that will be used.
   - Highlight how network reduction, dynamic stability analysis, or load flow simulations will be carried out, ensuring these methods align with the RFQ's requirements.

4. Validation Process:
   - Define the validation criteria and methods to compare the proposed models with the original network or system.
   - Outline fault cases, dynamic behavior tests, and any relevant simulations.
   - Provide clear benchmarks or error tolerances (e.g., voltage, angle, short circuit level comparison) that will be used to validate the models.

5. Deliverables:
   - List all the deliverables, such as reduced network models, validation reports, and simulation results.
   - Specify the format in which each deliverable will be provided (e.g., PowerFactory models, PSCAD files, Excel comparison tables).

6. Assumptions and Limitations:
   - Identify any assumptions that have been made regarding the data provided, modeling limitations, or tool compatibility.
   - List any system constraints (e.g., maximum number of buses, transformers, or generators) and clarify how these will be handled.

7. Timeline and Milestones:
   - Propose a clear timeline for the project, with major milestones (e.g., initial validation, submission of the first report, final model submission).
   - Include timeframes for weekly or bi-weekly follow-ups if required by the client.

8. Conclusion:
   - Summarize the technical advantages of the proposed approach.
   - Reaffirm how the proposal meets the client's expectations and how the deliverables will be achieved on time and to specification.

Additional Guidelines:
- Make sure to include references to any relevant standards (e.g., IEC 60909 for short-circuit analysis).
- Ensure that the language is formal and professional, addressing all aspects of the RFQ comprehensively.

Output Format: You should format the text in HTML. Do not provide the html in code blocks, in your response do not include 'html' tag. It should be normal text. Simply use appropriate HTML tags that are commonly used in articles or documents. For instance, use <h1> for the main heading, <h2> for subheadings, and <p> for paragraphs. Additionally, for lists, apply <ul> with <li> for unordered lists, or <ol> with <li> for ordered lists. When presenting tabular data, the <table> tag should be used, alongside <tr> for rows, and <th> and <td> for header and data cells, respectively. It is important to maintain a clear and professional tone throughout the document.
`;

// Function to generate technical proposal using OpenAI
async function generateTechnicalProposal(rfqContent) {
  const response = await openai.chat.completions.create({
    model: AI_MODELS.gpt4o,
    messages: [
      { role: 'system', content: technicalProposalPrompt },
      {
        role: 'user',
        content: `Here is the RFQ content:\n\n${rfqContent}\n\nPlease generate a technical proposal based on this RFQ.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

// Helper function to convert HTML to DOCX
const htmlToDocx = (html) => {
  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun(html)],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
};

// API route for document parsing and proposal generation
router.post(
  '/parse',
  [auth, role(['Admin', 'Bid Creator']), upload.single('document')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let parsedText;

      switch (req.file.mimetype) {
        case 'application/pdf':
          parsedText = await parsePDF(req.file.path);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          parsedText = await parseDOCX(req.file.path);
          break;
        case 'text/plain':
          parsedText = await readFileAsBuffer(req.file.path);
          parsedText = parsedText.toString('utf-8');
          break;
        default:
          return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);

      // Extract the original file name without extension
      const projectName = req.file.originalname.replace(/\.[^/.]+$/, '');

      // Generate the technical proposal using OpenAI
      const technicalProposal = await generateTechnicalProposal(parsedText);

      // Create a new Document instance
      const newDocument = new Document({
        name: `Technical Proposal - ${projectName}`,
        creator: req.user.id,
        usedModel: AI_MODELS.gpt4o,
        currentStatus: 'draft',
        versions: [],
      });

      // Create a folder in SharePoint
      const folderName = `${newDocument._id}`;
      console.log(`Creating folder in SharePoint: ${folderName}`);
      await createSharePointFolder(folderName);

      // Upload the JSON document to SharePoint
      const jsonFileName = `version-1.json`;
      const jsonContent = JSON.stringify(
        {
          content: {
            technicalProposal: projectName,
            sections: { 'Technical Proposal': technicalProposal },
          },
        },
        null,
        2
      );
      console.log(`Uploading JSON file to SharePoint: ${jsonFileName}`);
      await uploadFileToSharePoint(folderName, jsonFileName, jsonContent);

      // Create and upload the DOCX document to SharePoint
      const docxFileName = `version-1.docx`;
      const docxBuffer = await htmlToDocx(technicalProposal);
      console.log(`Uploading DOCX file to SharePoint: ${docxFileName}`);
      await uploadFileToSharePoint(folderName, docxFileName, docxBuffer);

      // Update the document with version info and save to MongoDB
      newDocument.versions.push({
        versionId: jsonFileName,
        versionNumber: 1,
        name: `Technical Proposal - ${projectName}`,
        content: {
          name: projectName,
          sections: { 'Technical Proposal': technicalProposal },
        },
        lastModified: new Date(),
        docxFile: docxFileName,
      });

      await newDocument.save();
      console.log('Document saved to MongoDB.');

      // Create an approval entry
      const approval = new Approval({
        document: newDocument._id,
        status: 'draft',
      });
      await approval.save();

      // Fetch all users
      const allUsers = await User.find();

      // Create notifications for all users
      const notifications = allUsers.map((user) => ({
        user: user._id,
        document: newDocument._id,
        text: `A new technical proposal has been generated from an RFQ by ${req.user.name}.`,
      }));
      await Notification.insertMany(notifications);

      res.json({
        message: 'Document parsed, proposal generated, and saved successfully',
        documentId: newDocument._id,
        technicalProposal,
      });
    } catch (error) {
      console.error('Error parsing document or generating proposal:', error);
      res.status(500).json({ error: 'Error processing document' });
    }
  }
);

module.exports = router;
