const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/classes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { branch_id, academic_group_id } = req.query;
    let query = `
      SELECT c.*, ag.name as academic_group_name, b.name as branch_name,
        (
          SELECT STRING_AGG(s.full_name, ', ' ORDER BY s.full_name)
          FROM staff s
          WHERE s.id = ANY(c.teacher_ids) OR s.id = c.teacher_id
        ) as teacher_name,
        (SELECT COUNT(*) FROM students WHERE class_id = c.id AND is_active = true) as student_count
      FROM classes c
      LEFT JOIN academic_groups ag ON ag.id = c.academic_group_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE c.org_id = $1`;
    const params = [req.admin.orgId];
    let paramCount = 1;

    if (branch_id) { paramCount++; query += ` AND c.branch_id = $${paramCount}`; params.push(branch_id); }
    if (academic_group_id) { paramCount++; query += ` AND c.academic_group_id = $${paramCount}`; params.push(academic_group_id); }

    query += ' ORDER BY ag.name, c.name, c.section';
    const result = await pool.query(query, params);
    res.json({ success: true, classes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/classes
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, section, academicGroupId, branchId, teacherId, teacherIds } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Class name is required.' });

    let idsArray = [];
    if (Array.isArray(teacherIds)) {
      idsArray = teacherIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    } else if (Array.isArray(teacherId)) {
      idsArray = teacherId.map(id => parseInt(id)).filter(id => !isNaN(id));
    } else if (teacherId) {
      idsArray = [parseInt(teacherId)];
    }
    const primaryId = idsArray.length > 0 ? idsArray[0] : null;

    const result = await pool.query(
      `INSERT INTO classes (org_id, name, class_name, section, academic_group_id, branch_id, teacher_id, teacher_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.admin.orgId,
        name,
        name,
        section || null,
        academicGroupId || null,
        branchId || null,
        primaryId,
        idsArray
      ]
    );
    res.status(201).json({ success: true, class: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/classes/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, section, academicGroupId, branchId, teacherId, teacherIds, isActive } = req.body;
    
    let idsArray = undefined;
    if (Array.isArray(teacherIds)) {
      idsArray = teacherIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    } else if (Array.isArray(teacherId)) {
      idsArray = teacherId.map(id => parseInt(id)).filter(id => !isNaN(id));
    } else if (teacherId !== undefined) {
      idsArray = teacherId ? [parseInt(teacherId)] : [];
    }

    const primaryId = idsArray !== undefined ? (idsArray.length > 0 ? idsArray[0] : null) : undefined;

    const result = await pool.query(
      `UPDATE classes SET
        name = COALESCE($1, name),
        class_name = COALESCE($1, class_name),
        section = COALESCE($2, section),
        academic_group_id = COALESCE($3, academic_group_id),
        branch_id = COALESCE($4, branch_id),
        teacher_id = CASE WHEN $5::boolean THEN $6::integer ELSE teacher_id END,
        teacher_ids = CASE WHEN $5::boolean THEN $7::integer[] ELSE teacher_ids END,
        is_active = COALESCE($8, is_active)
       WHERE id = $9 AND org_id = $10 RETURNING *`,
      [
        name || null,
        section || null,
        academicGroupId || null,
        branchId || null,
        idsArray !== undefined,
        primaryId !== undefined ? primaryId : null,
        idsArray !== undefined ? idsArray : null,
        isActive !== undefined ? isActive : null,
        req.params.id,
        req.admin.orgId
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Class not found.' });
    res.json({ success: true, class: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/classes/:id/assign-staff
router.put('/:id/assign-staff', authMiddleware, async (req, res) => {
  try {
    const { teacherIds } = req.body;
    const classId = req.params.id;

    const idsArray = Array.isArray(teacherIds) ? teacherIds.map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
    const primaryId = idsArray.length > 0 ? idsArray[0] : null;

    await pool.query(
      'UPDATE classes SET teacher_ids = $1, teacher_id = $2 WHERE id = $3 AND org_id = $4',
      [idsArray, primaryId, classId, req.admin.orgId]
    );

    res.json({ success: true, message: 'Staff assigned to class successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// DELETE /api/classes/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM classes WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Class deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
