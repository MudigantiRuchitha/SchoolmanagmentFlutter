const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Ensure first_name and last_name columns exist
pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name VARCHAR(255), ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)').catch(() => {});

// GET /api/students
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { branch_id, class_id, search } = req.query;
    let query = `
      SELECT s.*, COALESCE(c.name, c.class_name) as class_name, c.section, b.name as branch_name,
             (
               SELECT STRING_AGG(st.full_name, ', ') 
               FROM staff st 
               WHERE st.id = c.teacher_id 
                  OR (c.teacher_ids IS NOT NULL AND st.id = ANY(c.teacher_ids))
                  OR st.staff_id = c.teacher_id::text
             ) as teacher_name,
             (
               SELECT json_agg(
                 json_build_object(
                   'id', st.id,
                   'staff_id', COALESCE(st.staff_id, st.id::text),
                   'full_name', st.full_name,
                   'role_type', st.role_type,
                   'designation', st.designation,
                   'phone', st.phone,
                   'email', st.email
                 )
               )
               FROM staff st
               WHERE st.id = c.teacher_id 
                  OR (c.teacher_ids IS NOT NULL AND st.id = ANY(c.teacher_ids))
                  OR st.staff_id = c.teacher_id::text
             ) as assigned_staff
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE s.org_id = $1`;
    const params = [req.admin.orgId];
    let paramCount = 1;

    if (branch_id) { paramCount++; query += ` AND s.branch_id = $${paramCount}`; params.push(branch_id); }
    if (class_id) { paramCount++; query += ` AND s.class_id = $${paramCount}`; params.push(class_id); }
    if (search) {
      paramCount++;
      query += ` AND (LOWER(s.full_name) LIKE $${paramCount} OR LOWER(s.first_name) LIKE $${paramCount} OR LOWER(s.last_name) LIKE $${paramCount} OR LOWER(s.admission_no) LIKE $${paramCount} OR s.roll_no LIKE $${paramCount} OR s.roll_number LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    query += ' ORDER BY b.name, c.name, s.roll_no, s.full_name';
    const result = await pool.query(query, params);
    res.json({ success: true, students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/students/bulk-import - Bulk import students from CSV
router.post('/bulk-import', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { students } = req.body;
    const orgId = req.admin.orgId;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'No student records provided for import.' });
    }

    // Pre-fetch branches and classes for name matching
    const branchesRes = await client.query('SELECT id, name, code FROM branches WHERE org_id = $1', [orgId]);
    const classesRes = await client.query('SELECT id, name, section, branch_id FROM classes WHERE org_id = $1', [orgId]);

    const branchesList = branchesRes.rows;
    const classesList = classesRes.rows;

    let importedCount = 0;
    const errors = [];

    await client.query('BEGIN');

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rowNum = i + 1;

      const fName = row.firstName ? String(row.firstName).trim() : (row.fullName ? String(row.fullName).split(' ')[0].trim() : '');
      const lName = row.lastName ? String(row.lastName).trim() : (row.fullName ? String(row.fullName).split(' ').slice(1).join(' ').trim() : '');
      const fullName = row.fullName ? String(row.fullName).trim() : `${fName} ${lName}`.trim();
      const admissionNo = row.admissionNo ? String(row.admissionNo).trim() : '';
      const rollNo = row.rollNo ? String(row.rollNo).trim() : (admissionNo || String(rowNum));

      if (!fName && !fullName) {
        errors.push(`Row ${rowNum}: Student name is required.`);
        continue;
      }
      if (!admissionNo) {
        errors.push(`Row ${rowNum} (${fullName}): Admission number is required.`);
        continue;
      }

      // Resolve branch
      let branchId = null;
      if (row.branchId) {
        branchId = parseInt(row.branchId);
      } else if (row.branchName) {
        const matchedBranch = branchesList.find(b => 
          b.name.toLowerCase() === String(row.branchName).toLowerCase().trim() ||
          (b.code && b.code.toLowerCase() === String(row.branchName).toLowerCase().trim())
        );
        if (matchedBranch) branchId = matchedBranch.id;
      }
      if (!branchId && branchesList.length > 0) {
        branchId = branchesList[0].id;
      }

      // Resolve class
      let classId = null;
      if (row.classId) {
        classId = parseInt(row.classId);
      } else if (row.className) {
        const targetCls = String(row.className).toLowerCase().trim();
        const targetSec = row.section ? String(row.section).toLowerCase().trim() : '';
        const matchedClass = classesList.find(c => {
          const matchName = c.name.toLowerCase() === targetCls || `${c.name} ${c.section || ''}`.toLowerCase().trim() === targetCls;
          if (targetSec) return matchName && (c.section || '').toLowerCase() === targetSec;
          return matchName;
        });
        if (matchedClass) {
          classId = matchedClass.id;
          if (!branchId && matchedClass.branch_id) branchId = matchedClass.branch_id;
        }
      }

      let phone = row.phone ? String(row.phone).replace(/[^0-9]/g, '') : null;
      if (phone && phone.length > 10 && phone.startsWith('91')) phone = phone.slice(2);

      let parentPhone = row.parentPhone ? String(row.parentPhone).replace(/[^0-9]/g, '') : null;
      if (parentPhone && parentPhone.length > 10 && parentPhone.startsWith('91')) parentPhone = parentPhone.slice(2);

      await client.query(
        `INSERT INTO students (
          org_id, class_id, branch_id, admission_no, roll_no, roll_number,
          first_name, last_name, full_name, phone, parent_name, parent_phone,
          gender, date_of_birth, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)`,
        [
          orgId,
          classId,
          branchId,
          admissionNo,
          rollNo,
          rollNo,
          fName || fullName,
          lName || '',
          fullName,
          phone,
          row.parentName ? String(row.parentName).trim() : null,
          parentPhone || phone,
          row.gender ? String(row.gender).trim() : null,
          row.dateOfBirth || null
        ]
      );
      importedCount++;
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Successfully imported ${importedCount} student(s).`,
      importedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Students bulk import error:', err);
    res.status(500).json({ success: false, message: 'Failed to import students: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/students
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { admissionNo, rollNo, firstName, lastName, fullName, phone, parentName, parentPhone, gender, dateOfBirth, classId, branchId } = req.body;
    
    const fName = firstName !== undefined ? firstName.trim() : (fullName ? fullName.split(' ')[0] : '');
    const lName = lastName !== undefined ? lastName.trim() : (fullName ? fullName.split(' ').slice(1).join(' ') : '');
    const computedFullName = `${fName} ${lName}`.trim() || fullName || 'Student';

    if (!fName && !computedFullName) return res.status(400).json({ success: false, message: 'First name is required.' });

    let finalBranchId = branchId || null;
    if (!finalBranchId && classId) {
      const cRes = await pool.query('SELECT branch_id FROM classes WHERE id = $1', [classId]);
      if (cRes.rows.length > 0 && cRes.rows[0].branch_id) {
        finalBranchId = cRes.rows[0].branch_id;
      }
    }

    const rNo = rollNo || admissionNo || '';

    const result = await pool.query(
      `INSERT INTO students (org_id, class_id, branch_id, admission_no, roll_no, roll_number, first_name, last_name, full_name, phone, parent_name, parent_phone, gender, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        req.admin.orgId,
        classId || null,
        finalBranchId,
        admissionNo || null,
        rNo,
        rNo,
        fName,
        lName,
        computedFullName,
        phone || null,
        parentName || null,
        parentPhone || null,
        gender || null,
        dateOfBirth || null
      ]
    );
    res.status(201).json({ success: true, student: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// GET /api/students/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COALESCE(c.name, c.class_name) as class_name, c.section, b.name as branch_name
       FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.id = $1 AND s.org_id = $2`,
      [req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/students/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { admissionNo, rollNo, firstName, lastName, fullName, phone, parentName, parentPhone, gender, dateOfBirth, classId, branchId, isActive } = req.body;
    
    let fName = firstName !== undefined ? firstName.trim() : undefined;
    let lName = lastName !== undefined ? lastName.trim() : undefined;
    let computedFullName = undefined;

    if (fName !== undefined || lName !== undefined || fullName) {
      const f = fName !== undefined ? fName : (fullName ? fullName.split(' ')[0] : '');
      const l = lName !== undefined ? lName : (fullName ? fullName.split(' ').slice(1).join(' ') : '');
      computedFullName = `${f} ${l}`.trim() || fullName;
      fName = f;
      lName = l;
    }

    let finalBranchId = branchId;
    if (!finalBranchId && classId) {
      const cRes = await pool.query('SELECT branch_id FROM classes WHERE id = $1', [classId]);
      if (cRes.rows.length > 0 && cRes.rows[0].branch_id) {
        finalBranchId = cRes.rows[0].branch_id;
      }
    }

    const rNo = rollNo || admissionNo;

    const result = await pool.query(
      `UPDATE students SET
        admission_no = COALESCE($1, admission_no),
        roll_no = COALESCE($2, roll_no),
        roll_number = COALESCE($3, roll_number),
        full_name = COALESCE($4, full_name),
        phone = COALESCE($5, phone),
        parent_name = COALESCE($6, parent_name),
        parent_phone = COALESCE($7, parent_phone),
        gender = COALESCE($8, gender),
        date_of_birth = COALESCE($9, date_of_birth),
        class_id = COALESCE($10, class_id),
        branch_id = COALESCE($11, branch_id),
        is_active = COALESCE($12, is_active),
        first_name = COALESCE($13, first_name),
        last_name = COALESCE($14, last_name)
       WHERE id = $15 AND org_id = $16 RETURNING *`,
      [admissionNo, rNo, rNo, computedFullName, phone, parentName, parentPhone, gender, dateOfBirth, classId, finalBranchId, isActive, fName, lName, req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/students/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Student deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
