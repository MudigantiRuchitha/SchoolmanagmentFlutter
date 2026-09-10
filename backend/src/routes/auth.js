const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// POST /api/auth/login - Org Admin Login
router.post('/login', async (req, res) => {
  try {
    const { orgCode, username, password } = req.body;
    if (!orgCode || !username || !password) {
      return res.status(400).json({ success: false, message: 'Organization code, username and password are required.' });
    }

    // Find org
    const orgResult = await pool.query(
      'SELECT * FROM organisations WHERE LOWER(code) = LOWER($1) AND is_active = true',
      [orgCode]
    );
    if (orgResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid organization code.' });
    }
    const org = orgResult.rows[0];

    // Find admin user
    const userResult = await pool.query(
      'SELECT * FROM admin_users WHERE org_id = $1 AND LOWER(username) = LOWER($2) AND is_active = true',
      [org.id, username]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const user = userResult.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { adminId: user.id, orgId: org.id, orgCode: org.code, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
      org: {
        id: org.id,
        name: org.name,
        code: org.code,
        logoUrl: org.logo_url,
        timetable_access: org.timetable_access !== false,
        allowed_attendance_mode: org.allowed_attendance_mode || 'BOTH'
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    const userResult = await pool.query('SELECT * FROM admin_users WHERE id = $1', [req.admin.adminId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT au.*, o.name as org_name, o.code as org_code, o.logo_url, o.timetable_access, o.allowed_attendance_mode FROM admin_users au JOIN organisations o ON o.id = au.org_id WHERE au.id = $1',
      [req.admin.adminId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult.rows[0];
    delete user.password_hash;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
