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
    
    // Check admin_users table first
    let userRow = null;
    let userRole = (decoded.role || 'admin').toLowerCase();
    let rawBranchAccess = decoded.branchAccess || 'all';

    const adminResult = await pool.query(
      'SELECT id, role, branch_access, is_active FROM admin_users WHERE id = $1 AND org_id = $2',
      [decoded.adminId, decoded.orgId]
    );

    if (adminResult.rows.length > 0) {
      userRow = adminResult.rows[0];
      if (userRow.is_active === false) {
        return res.status(401).json({ success: false, message: 'Admin user is not active.' });
      }
      userRole = (userRow.role || 'admin').toLowerCase();
      rawBranchAccess = String(userRow.branch_access || 'all').trim();
    } else if (decoded.staffId) {
      // If staff user without dedicated admin_user row
      const staffResult = await pool.query(
        'SELECT id, role_type, branch_id, is_active FROM staff WHERE id = $1 AND org_id = $2',
        [decoded.staffId, decoded.orgId]
      );
      if (staffResult.rows.length === 0 || staffResult.rows[0].is_active === false) {
        return res.status(401).json({ success: false, message: 'Staff user is not active.' });
      }
      userRow = staffResult.rows[0];
      userRole = (userRow.role_type || decoded.role || 'teaching').toLowerCase();
      rawBranchAccess = userRow.branch_id ? String(userRow.branch_id) : 'all';
    } else {
      return res.status(401).json({ success: false, message: 'User is not active.' });
    }

    // Resolve branch scope
    let branchAccessId = 'all';
    let branchName = null;

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
      branchAccessId = String(branchResult.rows[0].id);
      branchName = branchResult.rows[0].name;
    }

    req.admin = {
      ...decoded,
      role: userRole,
      branchAccess: branchAccessId,
      branchName: branchName
    };

    // STRICT ENFORCEMENT FOR VIEWER (ONLY READ ACCESS):
    // Viewer is only allowed GET, HEAD, OPTIONS requests.
    // POST /api/auth/logout and POST /api/auth/change-password are permitted for self-management.
    const method = req.method.toUpperCase();
    const isReadMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const isSelfAuthAction = req.originalUrl?.includes('/api/auth/logout') || req.originalUrl?.includes('/api/auth/change-password');

    if (userRole === 'viewer' && !isReadMethod && !isSelfAuthAction) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You have Only Read (Viewer) access. You are not authorized to create, modify, or delete records.'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Middleware: Require Full Admin Access (role === 'admin')
const requireFullAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Full Admin privileges are required to perform this action.'
    });
  }
  next();
};

// Middleware: Require Write Access (cannot be viewer)
const requireWriteAccess = (req, res, next) => {
  if (!req.admin || req.admin.role === 'viewer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You have Only Read (Viewer) access. You cannot perform write operations.'
    });
  }
  next();
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

module.exports = { authMiddleware, superAuthMiddleware, requireFullAdmin, requireWriteAccess };
