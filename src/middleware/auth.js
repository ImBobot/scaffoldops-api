const jwt = require('jsonwebtoken');

// Roles that belong to your own company (as opposed to a client/builder
// user). Handy for routes that should never be visible to a builder.
const INTERNAL_ROLES = ['admin', 'manager', 'supervisor', 'worker'];
const STAFF_ROLES = ['admin', 'manager']; // can schedule jobs, manage materials, etc.

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, INTERNAL_ROLES, STAFF_ROLES };
