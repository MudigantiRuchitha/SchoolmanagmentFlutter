const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/leaves - List leaves with filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, staff_id, from_date, to_date } = req.query;
    let query = `
      SELECT l.*, s.full_name as staff_name, s.staff_id as staff_code, s.role_type,
        b.name as branch_name, au.full_name as reviewed_by_name
      FROM leaves l
      JOIN staff s ON s.id = l.staff_id
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN admin_users au ON au.id = l.reviewed_by
      WHERE l.org_id = $1`;
    const params = [req.admin.orgId];
    let pc = 1;

    if (status) { pc++; query += ` AND l.status = $${pc}`; params.push(status); }
    if (staff_id) { pc++; query += ` AND l.staff_id = $${pc}`; params.push(staff_id); }
    if (from_date) { pc++; query += ` AND l.from_date >= $${pc}`; params.push(from_date); }
    if (to_date) { pc++; query += ` AND l.to_date <= $${pc}`; params.push(to_date); }

    query += ' ORDER BY l.applied_at DESC';
    const result = await pool.query(query, params);

    const stats = {
      total: result.rows.length,
      pending: result.rows.filter(r => r.status === 'pending').length,
      approved: result.rows.filter(r => r.status === 'approved').length,
      rejected: result.rows.filter(r => r.status === 'rejected').length,
    };

    res.json({ success: true, leaves: result.rows, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/leaves/types - List leave types
router.get('/types', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leave_types WHERE org_id = $1 ORDER BY name', [req.admin.orgId]);
    res.json({ success: true, leaveTypes: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/leaves/types - Add leave type
router.post('/types', authMiddleware, async (req, res) => {
  try {
    const { name, maxDays } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Leave type name is required.' });
    const result = await pool.query(
      'INSERT INTO leave_types (org_id, name, max_days) VALUES ($1, $2, $3) RETURNING *',
      [req.admin.orgId, name, maxDays || 1]
    );
    res.status(201).json({ success: true, leaveType: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/leaves/types/:id - Delete leave type
router.delete('/types/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM leave_types WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Leave type deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/leaves - Apply for leave
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { staffId, leaveTypeId, leaveTypeName, fromDate, toDate, reason } = req.body;
    if (!staffId || !fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Staff, from date and to date are required.' });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const totalDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

    const result = await pool.query(
      `INSERT INTO leaves (org_id, staff_id, leave_type_id, leave_type_name, from_date, to_date, total_days, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.admin.orgId, staffId, leaveTypeId || null, leaveTypeName || null, fromDate, toDate, totalDays, reason || null]
    );
    res.status(201).json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/leaves/:id - Approve/Reject/Update
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, reviewComment, reason, fromDate, toDate, leaveTypeId, leaveTypeName } = req.body;
    let query, params;

    if (status === 'approved' || status === 'rejected') {
      query = `UPDATE leaves SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_comment = $3
               WHERE id = $4 AND org_id = $5 RETURNING *`;
      params = [status, req.admin.adminId, reviewComment || null, req.params.id, req.admin.orgId];
    } else {
      query = `UPDATE leaves SET
        reason = COALESCE($1, reason), from_date = COALESCE($2, from_date),
        to_date = COALESCE($3, to_date), leave_type_id = COALESCE($4, leave_type_id),
        leave_type_name = COALESCE($5, leave_type_name)
        WHERE id = $6 AND org_id = $7 AND status = 'pending' RETURNING *`;
      params = [reason, fromDate, toDate, leaveTypeId, leaveTypeName, req.params.id, req.admin.orgId];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Leave not found.' });
    res.json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/leaves/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM leaves WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Leave deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
