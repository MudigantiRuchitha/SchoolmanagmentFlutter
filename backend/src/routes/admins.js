const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authMiddleware, requireFullAdmin } = require('../middleware/auth');

// GET /api/admins
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, email, phone, role, branch_access, is_active, created_at
       FROM admin_users
       WHERE org_id = $1 AND (is_deleted IS NOT TRUE)${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? ' AND (branch_access = $2 OR branch_access = \'all\')' : ''}
       ORDER BY created_at DESC`,
      req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.admin.orgId, req.admin.branchAccess] : [req.admin.orgId]
    );
    res.json({ success: true, admins: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/admins
router.post('/', authMiddleware, requireFullAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role, branchAccess } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required.' });

    const existing = await pool.query('SELECT id FROM admin_users WHERE org_id = $1 AND LOWER(username) = LOWER($2) AND (is_deleted IS NOT TRUE)', [req.admin.orgId, username]);
    if (existing.rows.length > 0) return res.status(400).json({ success: false, message: 'Username already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO admin_users (org_id, username, password_hash, full_name, email, phone, role, branch_access) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, full_name, email, phone, role, branch_access, is_active, created_at',
      [req.admin.orgId, username, hash, fullName || null, email || null, phone || null, role || 'admin', branchAccess || 'all']
    );
    res.status(201).json({ success: true, admin: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/admins/:id
router.put('/:id', authMiddleware, requireFullAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, role, branchAccess, isActive, newPassword } = req.body;
    let hash = null;
    if (newPassword) hash = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      `UPDATE admin_users SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        role = COALESCE($4, role),
        branch_access = COALESCE($5, branch_access),
        is_active = COALESCE($6, is_active),
        password_hash = COALESCE($7, password_hash)
       WHERE id = $8 AND org_id = $9
       RETURNING id, username, full_name, email, phone, role, branch_access, is_active`,
      [fullName, email, phone, role, branchAccess, isActive, hash, req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Admin not found.' });
    res.json({ success: true, admin: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/admins/:id
router.delete('/:id', authMiddleware, requireFullAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.admin.adminId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    await pool.query('UPDATE admin_users SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Admin deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
