// routes/documents.js

require('dotenv').config();
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validation');
const Document = require('../models/Document');
const {
  createSharePointFolder,
  uploadFileToSharePoint,
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
      const folderName = `${projectName}-${newDocument._id}`;
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

// New route for updating a specific section
router.post('/update-section', async (req, res) => {
  console.log('Updating section...');
  try {
    const { projectId, sectionName, currentContent, updateInstructions } =
      req.body;

    // Fetch the document from the database
    const document = await Document.findById(projectId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    console.log('Document found XXX:', document);
    // Update the section content
    const updatedContent = await updateSectionContent(
      sectionName,
      currentContent,
      updateInstructions
    );

    // Update the document content
    document.content.sections[sectionName] = updatedContent;

    // Save the updated document to the database
    await document.save();

    // Upload the updated document to SharePoint
    const fileName = `${document.projectName}.docx`;
    const fileContent = JSON.stringify(document.content);
    const uploadResult = await uploadToSharePoint(fileName, fileContent);

    // Get the latest version number
    const latestVersion = await getLatestVersion(fileName);

    // Update the document metadata
    document.version = latestVersion;
    document.lastModified = new Date();
    await document.save();

    res.json({
      message: 'Section updated successfully',
      updatedContent,
      version: latestVersion,
    });
  } catch (error) {
    console.error('Error updating section:', error);
    res
      .status(500)
      .json({ message: 'Error updating section', error: error.message });
  }
});

module.exports = router;
