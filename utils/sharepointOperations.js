const axios = require('axios');

// Configuration variables for SharePoint
const SHAREPOINT_SITE_ID = process.env.SHAREPOINT_SITE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // Ensure this is securely stored and refreshed as needed

// Function to validate the access token format
function isValidJWT(token) {
  return token && token.split('.').length === 3;
}

// Function to create a folder in SharePoint
async function createSharePointFolder(folderName) {
  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  const folderCreationUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest:/children`;

  try {
    await axios.post(
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
    throw new Error('Error creating folder in SharePoint');
  }
}

// Function to upload a file to SharePoint
async function uploadFileToSharePoint(folderName, fileName, fileContent) {
  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

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
    throw new Error('Error uploading file to SharePoint');
  }
}

module.exports = {
  createSharePointFolder,
  uploadFileToSharePoint,
};
