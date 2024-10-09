// routes/documents.js

require('dotenv').config();
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validation');
const Document = require('../models/Document');
const { generateDocumentContent } = require('../utils/documentGeneration');
const {
  createSharePointFolder,
  uploadFileToSharePoint,
} = require('../utils/sharepointOperations');

// @route   POST /api/documents
// @desc    Create a new document and upload to SharePoint
// @access  Private (Bid Creator and Admin)
router.post(
  '/',
  auth,
  role(['Admin', 'Bid Creator']),
  validate([
    body('projectName', 'Project name is required').notEmpty(),
    body('projectDetails', 'Project details are required').notEmpty(),
  ]),
  async (req, res) => {
    const { projectName, projectDetails } = req.body;

    try {
      console.log('Received request to create document:', projectName);

      // Step 1: Generate document content using AI
      const documentContent = await generateDocumentContent(
        projectName,
        projectDetails
      );

      // Add console log to show document content
      console.log(
        'Generated document content:',
        JSON.stringify(documentContent, null, 2)
      );

      // Step 2: Create a new Document instance
      const newDocument = new Document({
        name: projectName,
        creator: req.user.id,
        usedModel: 'gpt-3.5-turbo',
        currentStatus: 'draft',
      });

      // Step 3: Create a folder in SharePoint
      const folderName = `${projectName}-${newDocument._id}`;
      await createSharePointFolder(folderName);

      // Step 4: Upload the document to SharePoint
      const fileName = `version-1.json`;
      const fileContent = JSON.stringify(documentContent, null, 2);
      await uploadFileToSharePoint(folderName, fileName, fileContent);

      // Step 5: Update the document with version info and save to MongoDB
      newDocument.versions.push({
        versionId: fileName,
        versionNumber: 1,
        content: documentContent,
        lastModified: new Date(),
      });

      await newDocument.save();
      console.log('Document saved to MongoDB.');

      // Respond with success message
      res.status(201).json({
        msg: 'Document created and uploaded to SharePoint successfully',
        documentId: newDocument._id,
      });
    } catch (err) {
      console.error('Error in document creation:', err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
