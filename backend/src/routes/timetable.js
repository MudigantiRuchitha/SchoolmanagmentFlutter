const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Auto-migrate database tables for timetable & attendance settings
async function initTimetableTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_attendance_settings (
          id SERIAL PRIMARY KEY,
          org_id INT NOT NULL,
          class_id INT REFERENCES classes(id) ON DELETE CASCADE,
          attendance_mode VARCHAR(50) NOT NULL DEFAULT 'MORNING_EVENING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_class_org_setting UNIQUE (org_id, class_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS timetable_slots (
          id SERIAL PRIMARY KEY,
          org_id INT NOT NULL,
          class_id INT REFERENCES classes(id) ON DELETE CASCADE,
          attendance_mode VARCHAR(50) NOT NULL DEFAULT 'MORNING_EVENING',
          slot_type VARCHAR(50) NOT NULL DEFAULT 'period',
          slot_number INT NOT NULL DEFAULT 1,
          slot_name VARCHAR(100) NOT NULL,
          subject_name VARCHAR(150),
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          teacher_id INT REFERENCES staff(id),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('Timetable tables auto-migration error:', err.message);
  }
}
initTimetableTables();

// GET /api/timetable/org-default - Get organisation default Morning & Evening settings
router.get('/org-default', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const slotsRes = await pool.query(
      `SELECT * FROM timetable_slots WHERE class_id IS NULL AND org_id = $1 ORDER BY slot_number`,
      [orgId]
    );

    res.json({
      success: true,
      attendanceMode: 'MORNING_EVENING',
      slots: slotsRes.rows
    });
  } catch (err) {
    console.error('Error fetching org default timetable:', err);
    res.status(500).json({ success: false, message: 'Server error fetching default timetable.' });
  }
});

// POST /api/timetable/org-default - Save organisation default Morning & Evening settings
// router.post('/org-default', authMiddleware, async (req, res) => {
//   const client = await pool.connect();
//   try {
//     const orgId = req.admin.orgId;
//     const { slots } = req.body; // Array of morning and evening slots

//     if (!slots || !Array.isArray(slots)) {
//       return res.status(400).json({ success: false, message: 'Slots array is required.' });
//     }

//     await client.query('BEGIN');
//     await client.query('DELETE FROM timetable_slots WHERE class_id IS NULL AND org_id = $1', [orgId]);

//     for (let i = 0; i < slots.length; i++) {
//       const slot = slots[i];
//       const slotType = slot.slotType || (i === 0 ? 'morning' : 'evening');
//       const slotNum = i + 1;
//       const slotName = slot.slotName || (slotType === 'morning' ? 'Morning Attendance' : 'Evening Attendance');
//       const startTime = slot.startTime || '09:00:00';
//       const endTime = slot.endTime || '09:30:00';

//       await client.query(
//         `INSERT INTO timetable_slots (org_id, class_id, attendance_mode, slot_type, slot_number, slot_name, start_time, end_time, is_active)
//          VALUES ($1, NULL, 'MORNING_EVENING', $2, $3, $4, $5, $6, true)`,
//         [orgId, slotType, slotNum, slotName, startTime, endTime]
//       );
//     }

//     await client.query('COMMIT');
//     res.json({ success: true, message: 'Organisation default Morning & Evening attendance saved!' });
//   } catch (err) {
//     await client.query('ROLLBACK');
//     console.error('Error saving org default timetable:', err);
//     res.status(500).json({ success: false, message: 'Failed to save default settings.' });
//   } finally {
//     client.release();
//   }
// });
router.post('/org-default', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.admin.orgId;
    const { slots } = req.body; // Array of morning and evening slots

    if (!slots || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Slots array is required.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM timetable_slots WHERE class_id IS NULL AND org_id = $1', [orgId]);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const slotType = slot.slotType || (i === 0 ? 'morning' : 'evening');
      const slotNum = i + 1;
      const slotName = slot.slotName || (slotType === 'morning' ? 'Morning Attendance' : 'Evening Attendance');
      const startTime = slot.startTime || '09:00:00';
      const endTime = slot.endTime || '09:30:00';

      await client.query(
        `INSERT INTO timetable_slots (org_id, class_id, attendance_mode, slot_type, slot_number, slot_name, start_time, end_time, is_active)
         VALUES ($1, NULL, 'MORNING_EVENING', $2, $3, $4, $5, $6, true)`,
        [orgId, slotType, slotNum, slotName, startTime, endTime]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Organisation default Morning & Evening attendance saved!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving org default timetable:', err);
    res.status(500).json({ success: false, message: 'Failed to save default settings.' });
  } finally {
    client.release();
  }
});

// GET /api/timetable/settings/:classId - Get configuration & slots for a class
router.get('/settings/:classId', authMiddleware, async (req, res) => {
  try {
    const classId = req.params.classId;
    const orgId = req.admin.orgId;

    // 1. Get Class Attendance Settings
    const settingRes = await pool.query(
      'SELECT attendance_mode FROM class_attendance_settings WHERE class_id = $1 AND org_id = $2',
      [classId, orgId]
    );

    const hasCustomSetting = settingRes.rows.length > 0;
    const attendanceMode = hasCustomSetting ? settingRes.rows[0].attendance_mode : 'MORNING_EVENING';

    // 2. Get Timetable Slots
    const slotsRes = await pool.query(
      `SELECT t.*, st.full_name as teacher_name 
       FROM timetable_slots t 
       LEFT JOIN staff st ON st.id = t.teacher_id 
       WHERE t.class_id = $1 AND t.org_id = $2 
       ORDER BY t.slot_number, t.start_time`,
      [classId, orgId]
    );

    let slots = slotsRes.rows;

    // If class has no custom slots and mode is MORNING_EVENING, fetch org-default slots dynamically from DB
    if (slots.length === 0 && attendanceMode === 'MORNING_EVENING') {
      const defaultRes = await pool.query(
        `SELECT * FROM timetable_slots WHERE class_id IS NULL AND org_id = $1 ORDER BY slot_number`,
        [orgId]
      );
      slots = defaultRes.rows;
    }

    res.json({
      success: true,
      classId: parseInt(classId),
      hasCustomSetting,
      attendanceMode,
      slots
    });
  } catch (err) {
    console.error('Error fetching timetable settings:', err);
    res.status(500).json({ success: false, message: 'Server error fetching timetable settings.' });
  }
});

// POST /api/timetable/settings/:classId - Save mode & slots configuration for a class
router.post('/settings/:classId', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const classId = req.params.classId;
    const orgId = req.admin.orgId;
    const { attendanceMode, slots } = req.body; // attendanceMode: 'MORNING_EVENING' or 'PERIOD_WISE', slots: Array

    if (!attendanceMode || !['MORNING_EVENING', 'PERIOD_WISE'].includes(attendanceMode)) {
      return res.status(400).json({ success: false, message: 'Valid attendanceMode (MORNING_EVENING or PERIOD_WISE) is required.' });
    }

    if (!slots || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Slots array is required.' });
    }

    await client.query('BEGIN');

    // 1. Upsert Class Attendance Settings
    await client.query(
      `INSERT INTO class_attendance_settings (org_id, class_id, attendance_mode)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, class_id) DO UPDATE SET attendance_mode = EXCLUDED.attendance_mode`,
      [orgId, classId, attendanceMode]
    );

    // 2. Clear old slots for this class
    await client.query('DELETE FROM timetable_slots WHERE class_id = $1 AND org_id = $2', [classId, orgId]);

    // 3. Insert new timetable slots
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const slotType = slot.slotType || (attendanceMode === 'MORNING_EVENING' ? (i === 0 ? 'morning' : 'evening') : 'period');
      const slotNum = slot.slotNumber || (i + 1);
      const slotName = slot.slotName || (slotType === 'morning' ? 'Morning Attendance' : slotType === 'evening' ? 'Evening Attendance' : `Period ${slotNum}`);
      const startTime = slot.startTime || '09:00:00';
      const endTime = slot.endTime || '09:45:00';
      const subjectName = slot.subjectName || null;
      const teacherId = slot.teacherId ? parseInt(slot.teacherId) : null;
      const isActive = slot.isActive !== undefined ? Boolean(slot.isActive) : true;

      await client.query(
        `INSERT INTO timetable_slots 
        (org_id, class_id, attendance_mode, slot_type, slot_number, slot_name, subject_name, start_time, end_time, teacher_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [orgId, classId, attendanceMode, slotType, slotNum, slotName, subjectName, startTime, endTime, teacherId, isActive]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Timetable & attendance configuration saved successfully!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving timetable settings:', err);
    res.status(500).json({ success: false, message: 'Failed to save timetable settings: ' + err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/timetable/slot/:slotId - Delete a single slot
router.delete('/slot/:slotId', authMiddleware, async (req, res) => {
  try {
    const slotId = req.params.slotId;
    await pool.query('DELETE FROM timetable_slots WHERE id = $1 AND org_id = $2', [slotId, req.admin.orgId]);
    res.json({ success: true, message: 'Timetable slot deleted.' });
  } catch (err) {
    console.error('Error deleting timetable slot:', err);
    res.status(500).json({ success: false, message: 'Server error deleting slot.' });
  }
});

router.get('/periods', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    // Retrieve organisation code
    const orgRes = await pool.query('SELECT code FROM organisations WHERE id = $1', [orgId]);
    const orgCode = orgRes.rows.length ? orgRes.rows[0].code : null;

    // Parse optional filters as integers (or null)
    const staffId = req.query.staffId ? parseInt(req.query.staffId) : null;
    const classId = req.query.classId ? parseInt(req.query.classId) : null;

    const baseQuery = `
      SELECT id,
             CASE
               WHEN slot_type = 'period' THEN 'Period ' || slot_number::text
               ELSE slot_name
             END AS slot_name
      FROM timetable_slots
      WHERE org_id = $1
        AND ($2::int IS NULL OR teacher_id = $2)
        AND ($3::int IS NULL OR class_id = $3)
        AND is_active = true
      ORDER BY slot_number`;
    const params = [orgId, staffId, classId];
    let result = await pool.query(baseQuery, params);

    // Fallback to organisation‑wide defaults if no rows match
    if (result.rows.length === 0) {
      const fallbackQuery = `
        SELECT id,
               CASE
                 WHEN slot_type = 'period' THEN 'Period ' || slot_number::text
                 ELSE slot_name
               END AS slot_name
        FROM timetable_slots
        WHERE org_id = $1
          AND ($2::int IS NULL OR teacher_id = $2)
          AND class_id IS NULL
          AND is_active = true
        ORDER BY slot_number`;
      result = await pool.query(fallbackQuery, [orgId, staffId]);
    }

    res.json({ success: true, orgCode, periods: result.rows });
  } catch (err) {
    console.error('Error fetching periods:', err);
    res.status(500).json({ success: false, message: 'Server error fetching periods.' });
  }
});

module.exports = router;
