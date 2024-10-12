const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
  },
  status: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'pending',
      'in_progress',
      'approved',
      'rejected',
    ],
    default: 'draft',
  },
  approvers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  comments: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Approval', ApprovalSchema);
