// routes/documents.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validation');
const Document = require('../models/Document');
const OpenAI = require('openai');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// @route   POST /api/documents
// @desc    Create a new document (without SharePoint integration)
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

      // Respond with "Done" and the document content
      res.status(201).json({
        msg: 'Done',
        documentContent,
      });
    } catch (err) {
      console.error('Error in document creation:', err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
