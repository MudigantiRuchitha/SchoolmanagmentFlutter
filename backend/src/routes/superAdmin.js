const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { superAuthMiddleware } = require('../middleware/auth');

// Auto-seed default superadmin credentials
async function initSuperAdmin() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150),
        email VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const hash = await bcrypt.hash('SuperAdmin@123', 10);
    await pool.query(`
      INSERT INTO super_admins (username, password_hash, full_name, email)
      VALUES ('superadmin', $1, 'Super Administrator', 'superadmin@school.com')
      ON CONFLICT (username) 
      DO UPDATE SET password_hash = $1, full_name = 'Super Administrator';
    `, [hash]);
  } catch (err) {
    console.error('SuperAdmin auto-seed error:', err.message);
  }
}
initSuperAdmin();

// POST /api/super-admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('[SuperAdminLogin] Attempt for username:', username);
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    const result = await pool.query('SELECT * FROM super_admins WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (result.rows.length === 0) {
      console.log('[SuperAdminLogin] User not found in DB:', username);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    const admin = result.rows[0];

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      console.log('[SuperAdminLogin] Password mismatch for username:', username);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    console.log('[SuperAdminLogin] Login successful for username:', username);

    const token = jwt.sign(
      { superAdminId: admin.id, username: admin.username },
      process.env.SUPER_ADMIN_JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      token,
      admin: { id: admin.id, username: admin.username, fullName: admin.full_name, email: admin.email }
    });
  } catch (err) {
    console.error('Super admin login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/super-admin/organisations - List all orgs
router.get('/organisations', superAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM admin_users WHERE org_id = o.id AND (is_deleted IS NOT TRUE)) as admin_count,
        (SELECT COUNT(*) FROM branches WHERE org_id = o.id AND (is_deleted IS NOT TRUE)) as branch_count,
        (SELECT COUNT(*) FROM students WHERE org_id = o.id AND (is_deleted IS NOT TRUE)) as student_count,
        (SELECT COUNT(*) FROM staff WHERE org_id = o.id AND (is_deleted IS NOT TRUE)) as staff_count
      FROM organisations o
      WHERE (o.is_deleted IS NOT TRUE)
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, organisations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/super-admin/organisations - Create new org + initial admin
router.post('/organisations', superAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, code, domain, address, phone, email, adminUsername, adminPassword, adminFullName, adminEmail, timetableAccess, allowedAttendanceMode } = req.body;

    if (!name || !code || !adminUsername || !adminPassword) {
      return res.status(400).json({ success: false, message: 'Organisation name, code, admin username and password are required.' });
    }

    // Check if org code exists
    const existing = await pool.query('SELECT id FROM organisations WHERE LOWER(code) = LOWER($1)', [code]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Organisation code already exists.' });
    }

    await client.query('BEGIN');

    // Create org
    const orgResult = await client.query(
      'INSERT INTO organisations (name, code, domain, address, phone, email, timetable_access, allowed_attendance_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, code.toLowerCase(), domain || null, address || null, phone || null, email || null, timetableAccess !== false, allowedAttendanceMode || 'BOTH']
    );
    const org = orgResult.rows[0];

    // Create initial admin user
    const hash = await bcrypt.hash(adminPassword, 10);
    await client.query(
      'INSERT INTO admin_users (org_id, username, password_hash, full_name, email, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [org.id, adminUsername, hash, adminFullName || adminUsername, adminEmail || null, 'admin']
    );

    await client.query('COMMIT');

    res.status(201).json({ success: true, message: 'Organisation created successfully.', organisation: org });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create org error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

// PUT /api/super-admin/organisations/:id - Update org
router.put('/organisations/:id', superAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, address, phone, email, isActive, timetableAccess, allowedAttendanceMode } = req.body;

    const result = await pool.query(
      `UPDATE organisations SET 
        name = COALESCE($1, name), 
        domain = COALESCE($2, domain), 
        address = COALESCE($3, address), 
        phone = COALESCE($4, phone), 
        email = COALESCE($5, email), 
        is_active = COALESCE($6, is_active),
        timetable_access = COALESCE($7, timetable_access),
        allowed_attendance_mode = COALESCE($8, allowed_attendance_mode)
       WHERE id = $9 RETURNING *`,
      [name, domain, address, phone, email, isActive, timetableAccess, allowedAttendanceMode, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organisation not found.' });
    }

    res.json({ success: true, organisation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/super-admin/organisations/:id
router.delete('/organisations/:id', superAuthMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE organisations SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Organisation deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/super-admin/stats - Platform stats
router.get('/stats', superAuthMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM organisations WHERE (is_deleted IS NOT TRUE)) as total_orgs,
        (SELECT COUNT(*) FROM organisations WHERE is_active = true AND (is_deleted IS NOT TRUE)) as active_orgs,
        (SELECT COUNT(*) FROM students WHERE (is_deleted IS NOT TRUE)) as total_students,
        (SELECT COUNT(*) FROM staff WHERE (is_deleted IS NOT TRUE)) as total_staff,
        (SELECT COUNT(*) FROM admin_users WHERE (is_deleted IS NOT TRUE)) as total_admins
    `);
    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/super-admin/change-password
router.post('/change-password', superAuthMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM super_admins WHERE id = $1', [req.superAdmin.superAdminId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found.' });

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE super_admins SET password_hash = $1 WHERE id = $2', [hash, req.superAdmin.superAdminId]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
