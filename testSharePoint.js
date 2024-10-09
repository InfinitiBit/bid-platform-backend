const express = require('express');
const axios = require('axios');
require('dotenv').config();
const app = express();
app.use(express.json());

// Configuration variables
const SHAREPOINT_SITE_URL =
  'https://infinitibit.sharepoint.com/sites/global/SharePointTest/';
const SHAREPOINT_SITE_ID = process.env.SHAREPOINT_SITE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // You'll store your access token here

// Add this function to validate the access token format
function isValidJWT(token) {
  return token.split('.').length === 3;
}

// Route to create a folder in SharePoint
app.post('/create-folder', async (req, res) => {
  const { folderName } = req.body; // Folder name to be created

  if (!folderName) {
    return res.status(400).send({ error: 'Folder name is required' });
  }

  // Validate the access token
  if (!isValidJWT(ACCESS_TOKEN)) {
    console.error('Invalid access token format');
    return res.status(500).send({ error: 'Invalid access token format' });
  }

  try {
    const folderCreationUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root/children`;

    // Make API call to create the folder
    const response = await axios.post(
      folderCreationUrl,
      {
        name: folderName,
        folder: {}, // Empty object signifies a folder in Microsoft Graph API
        '@microsoft.graph.conflictBehavior': 'rename', // Will rename the folder if it already exists
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res
      .status(200)
      .send({ message: 'Folder created successfully', data: response.data });
  } catch (error) {
    console.error(
      'Error creating folder:',
      error.response ? error.response.data : error.message
    );
    res.status(500).send({
      error: 'Error creating folder',
      details: error.response ? error.response.data : error.message,
    });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
