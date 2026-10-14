const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { isAfterSchoolHour } = require('../utils/attendanceHelper');

// GET /api/attendance/students - Get student attendance report
router.get('/students', authMiddleware, async (req, res) => {
  try {
    const { date, branch_id, class_id, from_date, to_date, period, report_type, from_time, to_time } = req.query;
    const orgId = req.admin.orgId;

    if (!from_date && !to_date) {
      // Single date view
      const targetDate = date || new Date().toISOString().split('T')[0];
      let query = `
        SELECT s.id, s.full_name, s.admission_no, s.roll_no, s.photo_url,
          c.name as class_name, c.section, b.name as branch_name,
          COALESCE(sa.id, dev_att.id) as attendance_id,
          COALESCE(sa.check_in, dev_att.session_time) as check_in,
          sa.check_out,
          COALESCE(sa.status, dev_att.status) as status,
          COALESCE(sa.mode, dev_att.mode) as mode,
          COALESCE(sa.notes, dev_att.remarks) as notes,
          COALESCE(sa.date::text, dev_att.session_date::text, $2) as date
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN student_attendance sa ON sa.student_id = s.id AND (sa.date::text = $2 OR sa.date::text LIKE $2 || '%')
        LEFT JOIN (
          SELECT DISTINCT ON (ar.student_id) ar.student_id, ar.id, ar.status, ar.remarks, ase.session_date, ase.session_time, 'device' as mode
          FROM attendance_records ar
          JOIN attendance_sessions ase ON ase.id = ar.session_id
          WHERE ase.session_date::text = $2 OR ase.session_date::text LIKE $2 || '%'
          ORDER BY ar.student_id, ar.id DESC
        ) dev_att ON dev_att.student_id = s.id
        WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE)`;
      const params = [orgId, targetDate];
      let pc = 2;

      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') { pc++; query += ` AND s.branch_id = $${pc}`; params.push(req.admin.branchAccess); }

      if (branch_id) { pc++; query += ` AND s.branch_id = $${pc}`; params.push(branch_id); }
      if (class_id) { pc++; query += ` AND s.class_id = $${pc}`; params.push(class_id); }
      query += ' ORDER BY b.name, c.name, s.roll_no, s.full_name';

      const result = await pool.query(query, params);
      const periodParams = [orgId, targetDate];
      let periodFilters = '';
      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
        periodParams.push(req.admin.branchAccess);
        periodFilters += ` AND s.branch_id = $${periodParams.length}`;
      }
      if (branch_id) {
        periodParams.push(branch_id);
        periodFilters += ` AND s.branch_id = $${periodParams.length}`;
      }
      if (class_id) {
        periodParams.push(class_id);
        periodFilters += ` AND s.class_id = $${periodParams.length}`;
      }
      if (period) {
        periodParams.push(period);
        periodFilters += ` AND t.slot_number::text = $${periodParams.length}`;
      }

      const periodResult = await pool.query(
        `SELECT s.id, s.full_name, s.admission_no, s.roll_no,
          c.id AS class_id, c.name AS class_name, c.section,
          b.id AS branch_id, b.name AS branch_name,
          t.slot_number AS period_number,
          t.slot_name AS period_name,
          CASE
            WHEN raw_match.id IS NULL THEN NULL
            WHEN raw_match.punch_time::time >= t.start_time
              AND raw_match.punch_time::time < t.end_time
              THEN COALESCE(
                NULLIF(LOWER(raw_match.raw_status), ''),
                NULLIF(LOWER(raw_match.raw_attendance_status), ''),
                'present'
              )
            ELSE COALESCE(
              NULLIF(LOWER(raw_match.raw_status), ''),
              NULLIF(LOWER(raw_match.raw_attendance_status), ''),
              'present'
            )
          END AS status,
          TO_CHAR(raw_match.punch_time, 'HH24:MI:SS') AS check_in,
          TO_CHAR(t.start_time, 'HH24:MI:SS') AS period_start_time,
          TO_CHAR(t.end_time, 'HH24:MI:SS') AS period_end_time
        FROM timetable_slots t
        JOIN students s ON s.class_id = t.class_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN LATERAL (
          SELECT ral.id, ral.punch_time,
            ral.raw_punch->>'Status' AS raw_status,
            ral.raw_punch->>'AttendanceStatus' AS raw_attendance_status
          FROM student_attendance_raw_logs ral
          WHERE ral.punch_time::date = $2
            AND (
              ral.period = t.slot_number::text
              OR LOWER(ral.period) = LOWER(t.slot_name)
              OR LOWER(ral.period) = LOWER('Period ' || t.slot_number::text)
            )
            AND (
              ral.student_id = s.id
              OR (
                ral.student_id IS NULL
                AND s.id = (
                  SELECT matched.id
                  FROM students matched
                  WHERE matched.admission_no = ral.admission_no
                    OR matched.roll_no = ral.admission_no
                    OR matched.roll_number = ral.admission_no
                    OR matched.id::text = ral.admission_no
                  ORDER BY CASE
                    WHEN matched.admission_no = ral.admission_no THEN 1
                    WHEN matched.roll_no = ral.admission_no THEN 2
                    WHEN matched.roll_number = ral.admission_no THEN 3
                    ELSE 4
                  END, matched.id
                  LIMIT 1
                )
              )
            )
          ORDER BY ral.received_at DESC, ral.id DESC
          LIMIT 1
        ) raw_match ON true
        WHERE t.org_id = $1
          AND t.class_id IS NOT NULL
          AND t.is_active = true
          AND (t.is_deleted IS NOT TRUE)
          AND s.org_id = $1
          AND s.is_active = true
          AND (s.is_deleted IS NOT TRUE)${periodFilters}
        ORDER BY t.slot_number, b.name, c.name, s.roll_no, s.full_name`,
        periodParams
      );
      const present = result.rows.filter(r => r.status === 'present').length;
      const absent = result.rows.filter(r => r.status === 'absent').length;
      const late = result.rows.filter(r => r.status === 'late').length;

      return res.json({
        success: true,
        records: result.rows,
        period_records: periodResult.rows,
        summary: { total: result.rows.length, present, absent, late }
      });
    }

    // Date range report
    if (report_type === 'detailed') {
      let query = `
        SELECT sa.date::text, s.id as student_id, s.full_name, s.admission_no, s.roll_no,
          c.name as class_name, c.section, b.name as branch_name,
          sa.check_in, sa.check_out, sa.status, sa.mode, sa.notes
        FROM student_attendance sa
        JOIN students s ON s.id = sa.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN branches b ON b.id = s.branch_id
        WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE) AND sa.date BETWEEN $2 AND $3`;
      const params = [orgId, from_date, to_date];
      let pc = 3;

      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') { pc++; query += ` AND s.branch_id = $${pc}`; params.push(req.admin.branchAccess); }
      if (branch_id) { pc++; query += ` AND s.branch_id = $${pc}`; params.push(branch_id); }
      if (class_id) { pc++; query += ` AND s.class_id = $${pc}`; params.push(class_id); }
      if (from_time) { pc++; query += ` AND sa.check_in >= $${pc}`; params.push(from_time); }
      if (to_time) { pc++; query += ` AND (sa.check_out <= $${pc} OR (sa.check_out IS NULL AND sa.check_in <= $${pc}))`; params.push(to_time); }

      query += ' ORDER BY sa.date DESC, b.name, c.name, s.roll_no, s.full_name';
      const result = await pool.query(query, params);
      return res.json({ success: true, records: result.rows });
    }

    // Summary report
    let query = `
      SELECT s.id, s.full_name, s.admission_no, s.roll_no,
        c.name as class_name, c.section, b.name as branch_name,
        COUNT(sa.id) as total_days,
        COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_days
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.date BETWEEN $2 AND $3
      WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE)`;
    const params = [orgId, from_date, to_date];
    let pc = 3;

    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') { pc++; query += ` AND s.branch_id = $${pc}`; params.push(req.admin.branchAccess); }

    if (branch_id) { pc++; query += ` AND s.branch_id = $${pc}`; params.push(branch_id); }
    if (class_id) { pc++; query += ` AND s.class_id = $${pc}`; params.push(class_id); }
    query += ' GROUP BY s.id, c.name, c.section, b.name ORDER BY b.name, c.name, s.full_name';

    const result = await pool.query(query, params);
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/attendance/students - Mark/update student attendance
router.post('/students', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { records } = req.body; // Array of { studentId, date, checkIn, checkOut, status, mode, notes }
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Records array is required.' });
    }

    await client.query('BEGIN');
    for (const rec of records) {
      if (!rec.status || String(rec.status).trim() === '') {
        await client.query(
          `DELETE FROM student_attendance WHERE student_id = $1 AND date = $2`,
          [rec.studentId, rec.date]
        );
        continue;
      }
      await client.query(
        `INSERT INTO student_attendance (student_id, org_id, date, check_in, check_out, status, mode, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (student_id, date) DO UPDATE SET
           check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
           status = EXCLUDED.status, mode = EXCLUDED.mode, notes = EXCLUDED.notes`,
        [rec.studentId, req.admin.orgId, rec.date, rec.checkIn || null, rec.checkOut || null,
         rec.status, rec.mode || 'manual', rec.notes || null]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: `${records.length} attendance record(s) saved.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

// GET /api/attendance/staff - Get staff attendance report
router.get('/staff', authMiddleware, async (req, res) => {
  try {
    const { date, branch_id, role_type, from_date, to_date, report_type, from_time, to_time } = req.query;
    const orgId = req.admin.orgId;

    if (!from_date && !to_date) {
      const targetDate = date || new Date().toISOString().split('T')[0];
      let query = `
        SELECT s.id, s.full_name, s.staff_id, s.role_type, s.designation, s.photo_url,
          b.name as branch_name,
          COALESCE(TO_CHAR(s.expected_check_in, 'HH24:MI'), '09:00') as expected_check_in,
          COALESCE(TO_CHAR(s.expected_check_out, 'HH24:MI'), '17:00') as expected_check_out,
          sa.id as attendance_id, sa.check_in, sa.check_out,
          CASE
            WHEN sa.check_in IS NOT NULL AND sa.check_in > COALESCE(s.expected_check_in, '09:00:00'::TIME) AND (sa.shift_status = 'present' OR sa.shift_status IS NULL)
            THEN 'late'
            ELSE sa.shift_status
          END as status,
          sa.mode, sa.notes, sa.date,
          COALESCE((
            SELECT JSON_AGG(JSON_BUILD_OBJECT(
              'time', TO_CHAR(sap.punch_time, 'HH24:MI:SS'),
              'mode', sap.mode
            ) ORDER BY sap.punch_time, sap.id)
            FROM staff_attendance_punches sap
            WHERE sap.staff_id = s.id AND sap.date = $2
          ), '[]'::json) AS punches
        FROM staff s
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN staff_attendance sa ON sa.staff_id = s.id AND sa.date = $2
        WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE)`;
      const params = [orgId, targetDate];
      let pc = 2;

      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') { pc++; query += ` AND s.branch_id = $${pc}`; params.push(req.admin.branchAccess); }

      if (branch_id) { pc++; query += ` AND s.branch_id = $${pc}`; params.push(branch_id); }
      if (role_type) { pc++; query += ` AND s.role_type = $${pc}`; params.push(role_type); }
      query += ' ORDER BY b.name, s.full_name';

      const result = await pool.query(query, params);
      const present = result.rows.filter(r => r.status === 'present').length;
      const absent = result.rows.filter(r => r.status === 'absent').length;
      const late = result.rows.filter(r => r.status === 'late').length;
      const halfDay = result.rows.filter(r => r.status === 'half-day').length;

      return res.json({ success: true, records: result.rows, summary: { total: result.rows.length, present, absent, late, halfDay } });
    }

    // Date range
    if (report_type === 'detailed') {
      let query = `
        SELECT sa.date::text, s.id as staff_id_num, s.full_name, s.staff_id, s.role_type, s.designation,
          b.name as branch_name,
          COALESCE(TO_CHAR(s.expected_check_in, 'HH24:MI'), '09:00') as expected_check_in,
          COALESCE(TO_CHAR(s.expected_check_out, 'HH24:MI'), '17:00') as expected_check_out,
          sa.check_in, sa.check_out,
          CASE
            WHEN sa.check_in IS NOT NULL AND sa.check_in > COALESCE(s.expected_check_in, '09:00:00'::TIME) AND (sa.shift_status = 'present' OR sa.shift_status IS NULL)
            THEN 'late'
            ELSE sa.shift_status
          END as status,
          sa.mode, sa.notes
        FROM staff_attendance sa
        JOIN staff s ON s.id = sa.staff_id
        LEFT JOIN branches b ON b.id = s.branch_id
        WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE) AND sa.date BETWEEN $2 AND $3`;
      const params = [orgId, from_date, to_date];
      let pc = 3;

      if (req.admin.branchAccess && req.admin.branchAccess !== 'all') { pc++; query += ` AND s.branch_id = $${pc}`; params.push(req.admin.branchAccess); }
      if (branch_id) { pc++; query += ` AND s.branch_id = $${pc}`; params.push(branch_id); }
      if (role_type) { pc++; query += ` AND s.role_type = $${pc}`; params.push(role_type); }
      if (from_time) { pc++; query += ` AND sa.check_in >= $${pc}`; params.push(from_time); }
      if (to_time) { pc++; query += ` AND (sa.check_out <= $${pc} OR (sa.check_out IS NULL AND sa.check_in <= $${pc}))`; params.push(to_time); }

      query += ' ORDER BY sa.date DESC, b.name, s.full_name';
      const result = await pool.query(query, params);
      return res.json({ success: true, records: result.rows });
    }

    // Summary
    let query = `
      SELECT s.id, s.full_name, s.staff_id, s.role_type, b.name as branch_name,
        COUNT(sa.id) as total_days,
        COUNT(CASE WHEN sa.shift_status = 'present' AND NOT (sa.check_in IS NOT NULL AND sa.check_in > COALESCE(s.expected_check_in, '09:00:00'::TIME)) THEN 1 END) as present_days,
        COUNT(CASE WHEN sa.shift_status = 'late' OR (sa.check_in IS NOT NULL AND sa.check_in > COALESCE(s.expected_check_in, '09:00:00'::TIME)) THEN 1 END) as late_days,
        COUNT(CASE WHEN sa.shift_status = 'absent' THEN 1 END) as absent_days
      FROM staff s
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN staff_attendance sa ON sa.staff_id = s.id AND sa.date BETWEEN $2 AND $3
      WHERE s.org_id = $1 AND s.is_active = true AND (s.is_deleted IS NOT TRUE)`;
    const params = [orgId, from_date, to_date];
    let pc = 3;

    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') { pc++; query += ` AND s.branch_id = $${pc}`; params.push(req.admin.branchAccess); }

    if (branch_id) { pc++; query += ` AND s.branch_id = $${pc}`; params.push(branch_id); }
    if (role_type) { pc++; query += ` AND s.role_type = $${pc}`; params.push(role_type); }
    query += ' GROUP BY s.id, b.name ORDER BY b.name, s.full_name';

    const result = await pool.query(query, params);
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/attendance/staff - Mark/update staff attendance
router.post('/staff', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Records array is required.' });
    }

    await client.query('BEGIN');
    for (const rec of records) {
      if (!rec.status || String(rec.status).trim() === '') {
        await client.query(
          `DELETE FROM staff_attendance WHERE staff_id = $1 AND date = $2`,
          [rec.staffId, rec.date]
        );
        continue;
      }

      let finalStatus = rec.status;
      if (rec.checkIn) {
        const staffRes = await client.query('SELECT expected_check_in FROM staff WHERE id = $1', [rec.staffId]);
        const expIn = staffRes.rows[0]?.expected_check_in || '09:00:00';
        if (isAfterSchoolHour(rec.checkIn, expIn) && (!finalStatus || finalStatus === 'present')) {
          finalStatus = 'late';
        }
      }

      await client.query(
        `INSERT INTO staff_attendance (staff_id, org_id, date, check_in, check_out, shift_status, mode, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (staff_id, date) DO UPDATE SET
           check_in = EXCLUDED.check_in,
           check_out = EXCLUDED.check_out,
           shift_status = EXCLUDED.shift_status, mode = EXCLUDED.mode, notes = EXCLUDED.notes`,
        [rec.staffId, req.admin.orgId, rec.date, rec.checkIn || null, rec.checkOut || null,
         finalStatus, rec.mode || 'manual', rec.notes || null]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: `${records.length} attendance record(s) saved.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

module.exports = router;
