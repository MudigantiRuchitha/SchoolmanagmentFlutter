const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Middleware for Org Admin authentication
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminResult = await pool.query('SELECT branch_access, is_active FROM admin_users WHERE id = $1 AND org_id = $2', [decoded.adminId, decoded.orgId]);
    if (adminResult.rows.length === 0 || adminResult.rows[0].is_active === false) {
      return res.status(401).json({ success: false, message: 'Admin user is not active.' });
    }

    const rawBranchAccess = String(adminResult.rows[0].branch_access || 'all').trim();
    if (rawBranchAccess !== 'all') {
      const branchResult = await pool.query(
        `SELECT id, name, code
         FROM branches
         WHERE org_id = $1
           AND (id::text = $2 OR LOWER(COALESCE(code, '')) = LOWER($2) OR LOWER(name) = LOWER($2))`,
        [decoded.orgId, rawBranchAccess]
      );
      if (branchResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Dedicated branch access is invalid.' });
      }
      req.admin = {
        ...decoded,
        branchAccess: String(branchResult.rows[0].id),
        branchName: branchResult.rows[0].name
      };
    } else {
      req.admin = { ...decoded, branchAccess: 'all' };
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Middleware for Super Admin authentication
const superAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SUPER_ADMIN_JWT_SECRET);
    req.superAdmin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired super admin token.' });
  }
};

module.exports = { authMiddleware, superAuthMiddleware };
