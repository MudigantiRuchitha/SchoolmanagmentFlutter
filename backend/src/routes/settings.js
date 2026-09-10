const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/settings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, code, domain, logo_url, address, phone, email, timetable_access, allowed_attendance_mode FROM organisations WHERE id = $1', [req.admin.orgId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Organisation not found.' });
    res.json({ success: true, settings: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/settings
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { name, domain, logoUrl, address, phone, email } = req.body;
    const result = await pool.query(
      `UPDATE organisations SET
        name = COALESCE($1, name), domain = COALESCE($2, domain),
        logo_url = COALESCE($3, logo_url), address = COALESCE($4, address),
        phone = COALESCE($5, phone), email = COALESCE($6, email)
       WHERE id = $7 RETURNING id, name, code, domain, logo_url, address, phone, email, timetable_access, allowed_attendance_mode`,
      [name, domain, logoUrl, address, phone, email, req.admin.orgId]
    );
    res.json({ success: true, settings: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
