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
const {
  TECHNICAL_PROPOSAL_PROMPT,
  REVIEW_TECHNICAL_PROPOSAL_PROMPT,
} = require('../utils/promptConstants');
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

// Function to generate technical proposal using OpenAI
async function generateTechnicalProposal(rfqContent) {
  const response = await openai.chat.completions.create({
    model: AI_MODELS.gpt4o,
    messages: [
      { role: 'system', content: TECHNICAL_PROPOSAL_PROMPT },
      {
        role: 'user',
        content: `Here is the RFQ content:\n\n${rfqContent}\n\nPlease generate a technical proposal based on this RFQ.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

// Function to review technical proposal using OpenAI
async function reviewTechnicalProposal(rfqContent, technicalProposal) {
  console.log('Reviewing technical proposal...');
  console.log('RFQ content:', rfqContent);
  const response = await openai.chat.completions.create({
    model: AI_MODELS.gpt4o,
    messages: [
      { role: 'system', content: REVIEW_TECHNICAL_PROPOSAL_PROMPT },
      {
        role: 'user',
        content: `Here is the RFQ content:\n\n${rfqContent}\n\nAnd here is the generated technical proposal:\n\n${technicalProposal}\n\nPlease review this technical proposal based on the RFQ.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

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

      // Review the generated technical proposal
      const proposalReview = await reviewTechnicalProposal(
        parsedText,
        technicalProposal
      );

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
          sections: {
            'Technical Proposal': technicalProposal,
          },
          proposalReview: proposalReview,
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
        message:
          'Document parsed, proposal generated, reviewed, and saved successfully',
        documentId: newDocument._id,
        technicalProposal,
        proposalReview,
      });
    } catch (error) {
      console.error(
        'Error parsing document, generating or reviewing proposal:',
        error
      );
      res.status(500).json({ error: 'Error processing document' });
    }
  }
);

module.exports = router;
