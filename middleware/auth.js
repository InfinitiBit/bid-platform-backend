// middleware/auth.js

const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('Authorization');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Remove 'Bearer ' prefix if present
    const bearerToken = token.startsWith('Bearer ')
      ? token.slice(7, token.length)
      : token;

    // Verify token
    const decoded = jwt.verify(bearerToken, process.env.JWT_SECRET);

    // Attach user to request
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Token is not valid:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
