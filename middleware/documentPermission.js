const Document = require('../models/Document');

module.exports = async function (req, res, next) {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ msg: 'Document not found' });
    }

    if (
      document.creator.toString() === req.user.id ||
      req.user.role === 'Admin'
    ) {
      req.document = document;
      next();
    } else if (
      req.user.role === 'Bid Reviewer' &&
      document.currentStatus === 'under review'
    ) {
      req.document = document;
      next();
    } else if (req.user.role === 'Bid Viewer' || req.user.role === 'Client') {
      // Add logic for Bid Viewer and Client access (e.g., check if the document is approved)
      if (document.currentStatus === 'approved') {
        req.document = document;
        next();
      } else {
        res.status(403).json({ msg: 'Access denied' });
      }
    } else {
      res.status(403).json({ msg: 'Not authorized' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
