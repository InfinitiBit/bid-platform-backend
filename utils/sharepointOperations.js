const axios = require('axios');

// Configuration variables for SharePoint
const SHAREPOINT_SITE_ID = process.env.SHAREPOINT_SITE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Add this function to validate the access token format
function isValidJWT(token) {
  return token && token.split('.').length === 3;
}

async function createSharePointFolder(folderName) {
  if (!isValidJWT(ACCESS_TOKEN)) {
    console.error('Invalid access token format');
    throw new Error('Invalid access token format');
  }

  console.log(`Creating folder in SharePoint: ${folderName}`);

  const folderCreationUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root/children`;

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
    return folderResponse.data;
  } catch (error) {
    console.error(
      'Error creating folder in SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error creating folder in SharePoint');
  }
}

async function uploadFileToSharePoint(folderName, fileName, fileContent) {
  console.log(`Uploading file to SharePoint: ${fileName}`);

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/${folderName}/${fileName}:/content`;

  try {
    const response = await axios.put(uploadUrl, fileContent, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('File uploaded successfully to SharePoint.');
    return response.data;
  } catch (error) {
    console.error(
      'Error uploading file to SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error uploading file to SharePoint');
  }
}

module.exports = { createSharePointFolder, uploadFileToSharePoint };
