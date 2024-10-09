// routes/documents.js

require('dotenv').config();
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const axios = require('axios');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validation');
const Document = require('../models/Document');
const OpenAI = require('openai');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration variables for SharePoint
const SHAREPOINT_SITE_ID = process.env.SHAREPOINT_SITE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // Ensure this is securely stored and refreshed as needed

// Add this function to validate the access token format
function isValidJWT(token) {
  return token && token.split('.').length === 3;
}

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

      // Step 1: Call OpenAI API to get project summary and sections
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
        return res
          .status(500)
          .json({ msg: 'Error parsing OpenAI response for summary.' });
      }

      const { summary, sections } = summaryData;

      if (!summary || !sections || !Array.isArray(sections)) {
        console.error('Invalid response format from OpenAI for summary.');
        return res
          .status(500)
          .json({ msg: 'Invalid response format from OpenAI for summary.' });
      }

      // Step 2: For each section, call OpenAI API to generate content
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

      // Step 3: Aggregate all sections into a JSON object
      const documentContent = {
        projectName,
        summary,
        sections: sectionContents,
      };

      // Add console log to show document content
      console.log(
        'Generated document content:',
        JSON.stringify(documentContent, null, 2)
      );

      // Step 4: Create a new Document instance
      const newDocument = new Document({
        name: projectName,
        creator: req.user.id,
        usedModel: 'gpt-3.5-turbo',
        currentStatus: 'draft',
      });

      // Validate the access token
      if (!isValidJWT(ACCESS_TOKEN)) {
        console.error('Invalid access token format');
        return res.status(500).json({ msg: 'Invalid access token format' });
      }

      // Step 5: Create a folder in SharePoint using Microsoft Graph API
      const folderName = `${projectName}-${newDocument._id}`;
      console.log(`Creating folder in SharePoint: ${folderName}`);

      const folderCreationUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest:/children`;

      try {
        const folderResponse = await axios.post(
          folderCreationUrl,
          {
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          },
          {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('Folder created successfully in SharePoint.');
      } catch (error) {
        console.error(
          'Error creating folder in SharePoint:',
          error.response ? error.response.data : error.message
        );
        return res.status(500).json({
          msg: 'Error creating folder in SharePoint',
          details: error.response ? error.response.data : error.message,
        });
      }

      // Step 6: Upload the document to SharePoint
      const fileName = `version-1.json`;
      const fileContent = JSON.stringify(documentContent, null, 2);
      console.log(`Uploading file to SharePoint: ${fileName}`);

      // Upload URL
      const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest/${folderName}/${fileName}:/content`;

      try {
        await axios.put(uploadUrl, fileContent, {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('File uploaded successfully to SharePoint.');
      } catch (error) {
        console.error(
          'Error uploading file to SharePoint:',
          error.response ? error.response.data : error.message
        );
        return res.status(500).json({
          msg: 'Error uploading file to SharePoint',
          details: error.response ? error.response.data : error.message,
        });
      }

      // Step 7: Update the document with version info and save to MongoDB
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
