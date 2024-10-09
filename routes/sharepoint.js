const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const {
  createSharePointFolder,
  uploadFileToSharePoint,
  getAllFilesAndFolders,
  deleteFileOrFolder,
  updateFile,
} = require('../utils/sharepointOperations');

// @route   POST /api/sharepoint/create-folder
// @desc    Create a new folder in SharePoint
// @access  Public (for testing purposes, consider adding authentication in production)
router.post(
  '/create-folder',
  [body('folderName', 'Folder name is required').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { folderName } = req.body;

    try {
      await createSharePointFolder(folderName);
      res.json({
        msg: `Folder "${folderName}" created successfully in SharePoint`,
      });
    } catch (error) {
      console.error('Error in create-folder route:', error.message);
      res.status(500).json({ msg: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/sharepoint/upload-file
// @desc    Upload a file to SharePoint
// @access  Public (for testing purposes, consider adding authentication in production)
router.post(
  '/upload-file',
  [
    body('folderName', 'Folder name is required').notEmpty(),
    body('fileName', 'File name is required').notEmpty(),
    body('fileContent', 'File content is required').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { folderName, fileName, fileContent } = req.body;

    try {
      await uploadFileToSharePoint(folderName, fileName, fileContent);
      res.json({
        msg: `File "${fileName}" uploaded successfully to "${folderName}" in SharePoint`,
      });
    } catch (error) {
      console.error('Error in upload-file route:', error.message);
      res.status(500).json({ msg: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/sharepoint/list
// @desc    Get all files and folders in SharePoint
// @access  Public (for testing purposes, consider adding authentication in production)
router.get('/list', async (req, res) => {
  try {
    const items = await getAllFilesAndFolders();
    res.json(items);
  } catch (error) {
    console.error('Error in list route:', error.message);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/sharepoint/delete
// @desc    Delete a file or folder in SharePoint
// @access  Public (for testing purposes, consider adding authentication in production)
router.delete(
  '/delete',
  [body('itemPath', 'Item path is required').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemPath } = req.body;

    try {
      await deleteFileOrFolder(itemPath);
      res.json({
        msg: `Item "${itemPath}" deleted successfully from SharePoint`,
      });
    } catch (error) {
      console.error('Error in delete route:', error.message);
      res.status(500).json({ msg: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/sharepoint/update-file
// @desc    Update a file in SharePoint
// @access  Public (for testing purposes, consider adding authentication in production)
router.put(
  '/update-file',
  [
    body('filePath', 'File path is required').notEmpty(),
    body('fileContent', 'File content is required').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { filePath, fileContent } = req.body;

    try {
      await updateFile(filePath, fileContent);
      res.json({
        msg: `File "${filePath}" updated successfully in SharePoint`,
      });
    } catch (error) {
      console.error('Error in update-file route:', error.message);
      res.status(500).json({ msg: 'Server error', error: error.message });
    }
  }
);

module.exports = router;
