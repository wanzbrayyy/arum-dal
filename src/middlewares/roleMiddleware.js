module.exports = function (roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ msg: 'Access denied. You do not have the required role.' });
    }
    next();
  };
};