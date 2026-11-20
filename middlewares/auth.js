const jwt = require('jsonwebtoken');
const { getDB, ObjectId } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_equiprent_2026_secure';

// Middleware: verify JWT Token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No authentication token provided.' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired authentication token.' });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('verifyToken middleware error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error verifying token.' });
  }
};

// Middleware: verify Renter (Customer)
const verifyRenter = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const role = req.user.role;
  if (role === 'Customer' || role === 'Owner' || role === 'Admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access forbidden: Customer/Renter privileges required.' });
};

// Middleware: verify Owner
const verifyOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const role = req.user.role;
  if (role === 'Owner' || role === 'Admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access forbidden: Equipment Owner privileges required.' });
};

// Middleware: verify Admin
const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.role === 'Admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access forbidden: Admin privileges required.' });
};

module.exports = {
  verifyToken,
  verifyRenter,
  verifyCustomer: verifyRenter, // alias for consistency
  verifyOwner,
  verifyAdmin
};
