// app.js

require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const documentsRouter = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

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
// app.use('/api/testSharePoint', require('./testSharePoint'));
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
