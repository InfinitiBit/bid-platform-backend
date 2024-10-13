// models/Document.js

const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currentStatus: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'in_progress',
      'under review',
      'approved',
      'rejected',
    ],
    default: 'draft',
  },
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
  usedModel: {
    type: String,
    default: 'gpt-3.5-turbo',
  },
});

module.exports = mongoose.model('Document', DocumentSchema);
