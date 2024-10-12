// routes/documents.js

require('dotenv').config();
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validation');
const Document = require('../models/Document');

const {
  createSharePointFolder,
  uploadFileToSharePoint,
  getFileFromSharePoint,
} = require('../utils/sharepointOperations');
const {
  generateDocumentContent,
  updateSectionContent,
} = require('../utils/documentGeneration');
const {
  uploadToSharePoint,
  getLatestVersion,
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

      // Generate document content
      const documentContent = await generateDocumentContent(
        projectName,
        projectDetails
      );

      // Create a new Document instance
      const newDocument = new Document({
        name: projectName,
        creator: req.user.id,
        usedModel: 'gpt-3.5-turbo',
        currentStatus: 'draft',
        versions: [], // Initialize the versions array
      });

      // Create a folder in SharePoint
      const folderName = `${newDocument._id}`;
      console.log(`Creating folder in SharePoint: ${folderName}`);
      await createSharePointFolder(folderName);

      // Upload the document to SharePoint
      const fileName = `version-1.json`;
      const fileContent = JSON.stringify(documentContent, null, 2);
      console.log(`Uploading file to SharePoint: ${fileName}`);
      await uploadFileToSharePoint(folderName, fileName, fileContent);

      // Update the document with version info and save to MongoDB

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

// Updated route for updating a specific section
router.post('/update-section', async (req, res) => {
  console.log('Updating section...');
  try {
    const { documentId, sectionName, updateInstructions } = req.body;

    // Fetch the document from MongoDB
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    console.log('Document found:', document);

    // Get the latest version of the document
    const latestVersion = document.versions[document.versions.length - 1];

    // Fetch the document content from SharePoint
    const folderName = `${document._id}`;
    const fileName = latestVersion.versionId;
    console.log(`Fetching file from SharePoint: ${folderName}/${fileName}`);
    const documentContent = await getFileFromSharePoint(folderName, fileName);

    console.log('Document content retrieved:', documentContent);

    // Update the section content
    const currentContent = documentContent.sections[sectionName];
    const updatedContent = await updateSectionContent(
      sectionName,
      currentContent,
      updateInstructions
    );

    // Update the document content
    documentContent.sections[sectionName] = updatedContent;

    // Create a new version
    const newVersionNumber = latestVersion.versionNumber + 1;
    const newVersionId = `version-${newVersionNumber}.json`;

    // Upload the updated document to SharePoint
    const newFileContent = JSON.stringify(documentContent, null, 2);
    await uploadFileToSharePoint(folderName, newVersionId, newFileContent);

    // Update the document in MongoDB
    const newVersion = {
      versionId: newVersionId,
      versionNumber: newVersionNumber,
      content: documentContent,
      lastModified: new Date(),
    };
    document.versions.push(newVersion);
    document.lastModified = new Date();
    await document.save();

    res.json({
      message: 'Section updated successfully',
      updatedContent,
      version: newVersionNumber,
    });
  } catch (error) {
    console.error('Error updating section:', error);
    res
      .status(500)
      .json({ message: 'Error updating section', error: error.message });
  }
});

// Add a new route for submitting a document for review
router.post(
  '/:id/submit',
  auth,
  role(['Bid Creator', 'Admin']),
  async (req, res) => {
    try {
      const document = await Document.findById(req.params.id);
      if (!document) {
        return res.status(404).json({ msg: 'Document not found' });
      }

      if (
        document.creator.toString() !== req.user.id &&
        req.user.role !== 'Admin'
      ) {
        return res.status(403).json({ msg: 'Not authorized' });
      }

      document.currentStatus = 'under review';
      await document.save();

      res.json({ msg: 'Document submitted for review', document });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// Add a new route for reviewing a document
router.post(
  '/:id/review',
  auth,
  role(['Bid Reviewer', 'Admin']),
  [
    body('status').isIn(['approved', 'rejected']).withMessage('Invalid status'),
    body('comments').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const document = await Document.findById(req.params.id);
      if (!document) {
        return res.status(404).json({ msg: 'Document not found' });
      }

      const review = new Review({
        document: document._id,
        reviewer: req.user.id,
        status: req.body.status,
        comments: req.body.comments,
      });

      await review.save();

      document.currentStatus = req.body.status;
      await document.save();

      res.json({ msg: 'Document reviewed', review, document });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET /api/documents
// @desc    Get all documents
// @access  Private (All authenticated users)
router.get('/', auth, async (req, res) => {
  try {
    // Fetch all documents from the database
    const documents = await Document.aggregate([
      {
        $addFields: {
          latestVersion: { $arrayElemAt: ['$versions', -1] },
        },
      },
      {
        $project: {
          name: 1,
          creator: 1,
          usedModel: 1,
          currentStatus: 1,
          lastModified: 1,
          'versions.versionId': 1,
          'versions.versionNumber': 1,
          'versions.lastModified': 1,
          'latestVersion.content': 1,
        },
      },
      { $sort: { lastModified: -1 } },
    ]);

    res.json(documents);
  } catch (err) {
    console.error('Error fetching documents:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
