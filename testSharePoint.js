// testSharePoint.js

const { sp } = require('@pnp/sp-commonjs');
const { SPFetchClient } = require('@pnp/nodejs-commonjs');
require('dotenv').config();

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

(async () => {
  try {
    const web = await sp.web.select('Title').get();
    console.log(`Connected to SharePoint site: ${web.Title}`);
  } catch (err) {
    console.error('Error connecting to SharePoint:', err.message);
  }
})();
