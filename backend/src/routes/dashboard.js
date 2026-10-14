const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const branchFilter = req.admin.branchAccess && req.admin.branchAccess !== 'all' ? ' AND branch_id = $2' : '';
    const params = req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [orgId, req.admin.branchAccess] : [orgId];
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM students WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE)${branchFilter}) as total_students,
        (SELECT COUNT(*) FROM staff WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE) AND role_type = 'teaching'${branchFilter}) as teaching_staff,
        (SELECT COUNT(*) FROM staff WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE) AND role_type = 'non-teaching'${branchFilter}) as non_teaching_staff,
        (SELECT COUNT(*) FROM staff WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE) AND role_type = 'management'${branchFilter}) as management_staff,
        (SELECT COUNT(*) FROM staff WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE)${branchFilter}) as total_staff,
        (SELECT COUNT(*) FROM admin_users WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE)) as total_admins,
        (SELECT COUNT(*) FROM classes WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE)${branchFilter}) as total_classes,
        (SELECT COUNT(*) FROM branches WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE)${branchFilter}) as total_branches
    `, params);

    res.json({ success: true, stats: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/dashboard/attendance-today
router.get('/attendance-today', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const { type = 'student', branch_id, class_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    if (type === 'student') {
      let query = `
        SELECT
          s.id, s.full_name, s.admission_no, s.roll_no, s.photo_url,
          c.name as class_name, c.section, b.name as branch_name,
          sa.check_in, sa.check_out, sa.status, sa.mode,
          sa.id as attendance_id
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.date = $2
        WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE)
      `;
      const params = [orgId, targetDate];
      let paramCount = 2;

      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
        paramCount++;
        query += ` AND s.branch_id = $${paramCount}`;
        params.push(req.admin.branchAccess);
      }

      if (branch_id) {
        paramCount++;
        query += ` AND s.branch_id = $${paramCount}`;
        params.push(branch_id);
      }
      if (class_id) {
        paramCount++;
        query += ` AND s.class_id = $${paramCount}`;
        params.push(class_id);
      }

      query += ' ORDER BY b.name, c.name, s.full_name';
      const result = await pool.query(query, params);

      const totalPresent = result.rows.filter(r => r.status === 'present').length;
      const totalAbsent = result.rows.filter(r => r.status === 'absent').length;
      const totalLate = result.rows.filter(r => r.status === 'late').length;

      res.json({ success: true, records: result.rows, summary: { total: result.rows.length, present: totalPresent, absent: totalAbsent, late: totalLate } });
    } else {
      let query = `
        SELECT
          s.id, s.full_name, s.staff_id, s.photo_url, s.role_type, s.designation,
          b.name as branch_name,
          sa.check_in, sa.check_out,
          CASE
            WHEN sa.check_in IS NOT NULL AND sa.check_in > COALESCE(s.expected_check_in, '09:00:00'::TIME) AND (sa.shift_status = 'present' OR sa.shift_status IS NULL)
            THEN 'late'
            ELSE sa.shift_status
          END as status,
          sa.mode,
          sa.id as attendance_id
        FROM staff s
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN staff_attendance sa ON sa.staff_id = s.id AND sa.date = $2
        WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE)
      `;
      const params = [orgId, targetDate];
      let paramCount = 2;

      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
        paramCount++;
        query += ` AND s.branch_id = $${paramCount}`;
        params.push(req.admin.branchAccess);
      }

      if (branch_id) {
        paramCount++;
        query += ` AND s.branch_id = $${paramCount}`;
        params.push(branch_id);
      }

      query += ' ORDER BY b.name, s.full_name';
      const result = await pool.query(query, params);

      const totalPresent = result.rows.filter(r => r.status === 'present').length;
      const totalAbsent = result.rows.filter(r => r.status === 'absent').length;
      const totalLate = result.rows.filter(r => r.status === 'late').length;

      res.json({ success: true, records: result.rows, summary: { total: result.rows.length, present: totalPresent, absent: totalAbsent, late: totalLate } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/dashboard/recent-notices
router.get('/recent-notices', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notices WHERE org_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE) ORDER BY created_at DESC LIMIT 5',
      [req.admin.orgId]
    );
    res.json({ success: true, notices: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
