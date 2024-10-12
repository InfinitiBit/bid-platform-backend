// app.js

require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const documentsRouter = require('./routes/documents');
const sharepointRoutes = require('./routes/sharepoint');
const cors = require('cors');
const { initializeTokenRefresh } = require('./utils/sharepointAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:5173', // Allow only this origin
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

// Routes placeholder
app.use('/api', require('./routes/index'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/protected', require('./routes/protected'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/docTest', require('./routes/docTest'));
app.use('/api/sharepoint', sharepointRoutes); // Add this line
// app.use('/api/testSharePoint', require('./testSharePoint'));

// Check for required environment variables
const requiredEnvVars = [
  'SHAREPOINT_CLIENT_ID',
  'SHAREPOINT_CLIENT_SECRET',
  'SHAREPOINT_TENANT_ID',
  'SHAREPOINT_SCOPE_URL',
  'SHAREPOINT_SITE_ID',
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error(
    'Missing required environment variables:',
    missingEnvVars.join(', ')
  );
  process.exit(1);
}

// Initialize SharePoint token refresh
initializeTokenRefresh().catch((error) => {
  console.error('Failed to initialize SharePoint token:', error.message);
  process.exit(1);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
