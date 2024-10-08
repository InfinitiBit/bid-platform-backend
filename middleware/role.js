// middleware/role.js

module.exports = function (requiredRoles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    if (requiredRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ msg: 'Forbidden: Access is denied' });
    }
  };
};
