const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { comparePassword } = require('../utils/password');
const { recordStaffLoginAttendance, recordStaffLogoutAttendance } = require('../utils/attendanceHelper');

// POST /api/auth/login - Org Admin Login
router.post('/login', async (req, res) => {
  try {
    const { orgCode, username, password } = req.body;
    if (!orgCode || !username || !password) {
      return res.status(400).json({ success: false, message: 'Organization code, username and password are required.' });
    }

    // Find org
    const orgResult = await pool.query(
      'SELECT * FROM organisations WHERE LOWER(code) = LOWER($1) AND is_active = true AND (is_deleted IS NOT TRUE)',
      [orgCode]
    );
    if (orgResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid organization code.' });
    }
    const org = orgResult.rows[0];

    // Find admin user
    const userResult = await pool.query(
      'SELECT * FROM admin_users WHERE org_id = $1 AND LOWER(username) = LOWER($2) AND is_active = true AND (is_deleted IS NOT TRUE)',
      [org.id, username]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      // Check if admin corresponds to a staff member in the same organisation
      const staffMatch = await pool.query(
        'SELECT * FROM staff WHERE org_id = $1 AND (LOWER(username) = LOWER($2) OR LOWER(email) = LOWER($3)) AND is_active = true AND (is_deleted IS NOT TRUE) LIMIT 1',
        [org.id, user.username, user.email || '']
      );

      let staffId = null;
      if (staffMatch.rows.length > 0) {
        staffId = staffMatch.rows[0].id;
        // Record exact login check-in for staff
        await recordStaffLoginAttendance(pool, staffMatch.rows[0]);
      }

      // Generate JWT
      const token = jwt.sign(
        { adminId: user.id, staffId, orgId: org.id, orgCode: org.code, username: user.username, role: user.role, branchAccess: user.branch_access || 'all' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          staffId,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          branchAccess: user.branch_access || 'all',
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
    }

    // If not found in admin_users, check staff table
    const staffResult = await pool.query(
      `SELECT * FROM staff 
       WHERE org_id = $1 AND (LOWER(username) = LOWER($2) OR LOWER(email) = LOWER($2) OR staff_id = $2 OR id::text = $2) 
         AND is_active = true AND (is_deleted IS NOT TRUE) LIMIT 1`,
      [org.id, username]
    );

    if (staffResult.rows.length > 0) {
      const staffUser = staffResult.rows[0];
      const isMatch = await comparePassword(password, staffUser.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      // Record exact login check-in for staff
      await recordStaffLoginAttendance(pool, staffUser);

      const token = jwt.sign(
        {
          adminId: staffUser.id,
          staffId: staffUser.id,
          orgId: org.id,
          orgCode: org.code,
          username: staffUser.username || staffUser.staff_id,
          role: staffUser.role_type || 'teaching',
          branchAccess: staffUser.branch_id ? String(staffUser.branch_id) : 'all'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: staffUser.id,
          staffId: staffUser.id,
          username: staffUser.username || staffUser.staff_id,
          fullName: staffUser.full_name,
          email: staffUser.email,
          role: staffUser.role_type || 'teaching',
          branchAccess: staffUser.branch_id ? String(staffUser.branch_id) : 'all',
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
    }

    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
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
      'SELECT au.*, o.name as org_name, o.code as org_code, o.logo_url, o.timetable_access, o.allowed_attendance_mode FROM admin_users au JOIN organisations o ON o.id = au.org_id WHERE au.id = $1 AND (au.is_deleted IS NOT TRUE) AND (o.is_deleted IS NOT TRUE)',
      [req.admin.adminId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult.rows[0];
    delete user.password_hash;
    res.json({
      success: true,
      user: {
        ...user,
        fullName: user.full_name,
        branchAccess: user.branch_access || 'all'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/logout - Logout user and record exact check_out time for staff
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin?.orgId;
    const staffId = req.admin?.staffId;
    const username = req.admin?.username;

    let staffRow = null;
    if (staffId) {
      const sRes = await pool.query('SELECT * FROM staff WHERE id = $1', [staffId]);
      if (sRes.rows.length > 0) staffRow = sRes.rows[0];
    } else if (username && orgId) {
      const sRes = await pool.query(
        'SELECT * FROM staff WHERE org_id = $1 AND (LOWER(username) = LOWER($2) OR LOWER(email) = LOWER($2)) AND is_active = true LIMIT 1',
        [orgId, username]
      );
      if (sRes.rows.length > 0) staffRow = sRes.rows[0];
    }

    if (staffRow) {
      await recordStaffLogoutAttendance(pool, staffRow);
    }

    res.json({ success: true, message: 'Logged out successfully, checkout recorded.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.json({ success: true, message: 'Logged out.' });
  }
});

module.exports = router;
