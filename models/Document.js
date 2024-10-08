// models/Document.js

const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  usedModel: { type: String, default: 'gpt-3.5-turbo' },
  createdAt: { type: Date, default: Date.now },
  currentStatus: {
    type: String,
    enum: ['draft', 'submitted', 'in process', 'approved'],
    default: 'draft',
  },
  approvalStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalLineup: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  versions: [
    {
      versionId: { type: String },
      versionNumber: { type: Number },
      content: { type: Object }, // JSON content
      lastModified: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('Document', DocumentSchema);
