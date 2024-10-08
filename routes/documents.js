// routes/documents.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validation');
const Document = require('../models/Document');
const OpenAI = require('openai');
const { sp } = require('@pnp/sp-commonjs');
const { SPFetchClient } = require('@pnp/nodejs-commonjs');
require('dotenv').config();

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Setup SharePoint
sp.setup({
  sp: {
    fetchClientFactory: () =>
      new SPFetchClient(
        process.env.SHAREPOINT_SITE_URL,
        process.env.SHAREPOINT_CLIENT_ID,
        process.env.SHAREPOINT_CLIENT_SECRET
      ),
  },
});

// @route   POST /api/documents
// @desc    Create a new document
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

      // Step 1: Call OpenAI API to get project summary and sections
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

      console.log(
        'OpenAI summary response:',
        summaryResponse.choices[0].message
      );

      // Parse the response as JSON
      let summaryData;
      try {
        summaryData = JSON.parse(summaryResponse.choices[0].message.content);
      } catch (err) {
        return res.status(500).json({ msg: 'Error parsing OpenAI response' });
      }

      const { summary, sections } = summaryData;

      if (!summary || !sections || !Array.isArray(sections)) {
        return res.status(500).json({ msg: 'Invalid response from OpenAI' });
      }

      // Step 2: For each section, call OpenAI API to generate content
      const sectionContents = {};
      for (const section of sections) {
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

        const sectionContent = sectionResponse.data.choices[0].message.content;
        sectionContents[section] = sectionContent;
      }

      // Step 3: Aggregate all sections into a JSON object
      const documentContent = {
        projectName,
        summary,
        sections: sectionContents,
      };

      // Step 4: Create a new Document instance
      const newDocument = new Document({
        name: projectName,
        creator: req.user.id,
        usedModel: 'gpt-3.5-turbo',
        currentStatus: 'draft',
      });

      // Step 5: Create a folder in SharePoint
      const folderName = `${projectName}-${newDocument._id}`;
      await sp.web.folders.add(`Shared Documents/${folderName}`);

      // Step 6: Upload the JSON file to SharePoint
      const fileName = `version-1.json`;
      const fileContent = JSON.stringify(documentContent, null, 2);

      await sp.web
        .getFolderByServerRelativeUrl(`Shared Documents/${folderName}`)
        .files.add(fileName, fileContent, true);

      // Step 7: Update the document with version info and save to MongoDB
      newDocument.versions.push({
        versionId: fileName,
        versionNumber: 1,
        content: documentContent,
        lastModified: new Date(),
      });

      await newDocument.save();

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
