const axios = require('axios');
require('dotenv').config();

let accessToken = null;
let tokenExpirationTime = null;

async function getSharePointToken() {
  if (accessToken && tokenExpirationTime && Date.now() < tokenExpirationTime) {
    return accessToken;
  }

  try {
    console.log('Attempting to get SharePoint token...');
    console.log('SHAREPOINT_TENANT_ID:', process.env.SHAREPOINT_TENANT_ID);
    console.log('SHAREPOINT_CLIENT_ID:', process.env.SHAREPOINT_CLIENT_ID);
    console.log(
      'SHAREPOINT_CLIENT_SECRET:',
      process.env.SHAREPOINT_CLIENT_SECRET ? '[REDACTED]' : 'undefined'
    );
    console.log('SHAREPOINT_SCOPE_URL:', process.env.SHAREPOINT_SCOPE_URL);

    const response = await axios.post(
      `https://login.microsoftonline.com/${process.env.SHAREPOINT_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SHAREPOINT_CLIENT_ID,
        client_secret: process.env.SHAREPOINT_CLIENT_SECRET,
        scope: process.env.SHAREPOINT_SCOPE_URL,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // console.log('SharePoint token response:', response.data);
    accessToken = response.data.access_token;
    tokenExpirationTime = Date.now() + response.data.expires_in * 1000;

    return accessToken;
  } catch (error) {
    console.error('Error getting SharePoint token:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    throw error;
  }
}

async function initializeTokenRefresh() {
  setInterval(async () => {
    try {
      await getSharePointToken();
      console.log('SharePoint token refreshed successfully');
    } catch (error) {
      console.error('Error refreshing SharePoint token:', error.message);
    }
  }, 3500000); // Refresh every 58 minutes (3500000 ms)
}

module.exports = { getSharePointToken, initializeTokenRefresh };
