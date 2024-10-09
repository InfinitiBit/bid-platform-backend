// models/Document.js

const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  projectName: String,
  content: Object,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  versions: [
    {
      versionId: String,
      versionNumber: Number,
      content: Object,
      lastModified: Date,
    },
  ],
});

module.exports = mongoose.model('Document', DocumentSchema);
