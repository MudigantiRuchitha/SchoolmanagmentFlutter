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
    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
      paramCount++;
      query += ` AND s.branch_id = $${paramCount}`;
      params.push(req.admin.branchAccess);
    }

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
// POST /api/students/bulk-import - Bulk import students from CSV
router.post('/bulk-import', authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { students } = req.body;
    const orgId = req.admin.orgId;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No student records provided for import.'
      });
    }

    // ---------------------------------------------------------
    // 1. Get branches and classes
    // ---------------------------------------------------------

    const branchesRes = await client.query(
      `SELECT id, name, code
       FROM branches
       WHERE org_id = $1
       ${req.admin.branchAccess && req.admin.branchAccess !== 'all'
         ? 'AND id = $2'
         : ''}`,
      req.admin.branchAccess && req.admin.branchAccess !== 'all'
        ? [orgId, req.admin.branchAccess]
        : [orgId]
    );

    const classesRes = await client.query(
      `SELECT id, name, section, branch_id
       FROM classes
       WHERE org_id = $1
       ${req.admin.branchAccess && req.admin.branchAccess !== 'all'
         ? 'AND branch_id = $2'
         : ''}`,
      req.admin.branchAccess && req.admin.branchAccess !== 'all'
        ? [orgId, req.admin.branchAccess]
        : [orgId]
    );

    const branchesList = branchesRes.rows;
    const classesList = classesRes.rows;

    const errors = [];
    const preparedStudents = [];

    // ---------------------------------------------------------
    // 2. Check duplicate admission numbers inside the CSV
    // ---------------------------------------------------------

    const csvAdmissionNumbers = new Map();

    students.forEach((row, index) => {
      const rowNum = index + 2; // +2 because CSV row 1 is header

      const admissionNo = row.admissionNo
        ? String(row.admissionNo).trim()
        : '';

      if (!admissionNo) return;

      const normalizedAdmissionNo = admissionNo.toLowerCase();

      if (!csvAdmissionNumbers.has(normalizedAdmissionNo)) {
        csvAdmissionNumbers.set(normalizedAdmissionNo, []);
      }

      csvAdmissionNumbers.get(normalizedAdmissionNo).push({
        rowNum,
        admissionNo
      });
    });

    csvAdmissionNumbers.forEach((rows, normalizedAdmissionNo) => {
      if (rows.length > 1) {
        const rowNumbers = rows.map(r => r.rowNum).join(', ');

        errors.push(
          `Admission number "${rows[0].admissionNo}" is duplicated inside the uploaded CSV. CSV rows: ${rowNumbers}.`
        );
      }
    });

    // ---------------------------------------------------------
    // 3. Check admission numbers already existing in database
    // ---------------------------------------------------------

    const admissionNumbers = [
      ...csvAdmissionNumbers.keys()
    ];

    if (admissionNumbers.length > 0) {
      const existingRes = await client.query(
        `SELECT admission_no, full_name
         FROM students
         WHERE org_id = $1
           AND LOWER(TRIM(admission_no)) = ANY($2::text[])`,
        [
          orgId,
          admissionNumbers
        ]
      );

      existingRes.rows.forEach(existingStudent => {
        errors.push(
          `Admission number "${existingStudent.admission_no}" is already used by student "${existingStudent.full_name || 'Unknown Student'}" in this organisation.`
        );
      });
    }

    // ---------------------------------------------------------
    // 4. If duplicates were found, STOP BEFORE INSERTING
    // ---------------------------------------------------------

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the duplicate admission numbers before importing.',
        errors
      });
    }

    // ---------------------------------------------------------
    // 5. Prepare all students
    // ---------------------------------------------------------

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rowNum = i + 2;

      const fName = row.firstName
        ? String(row.firstName).trim()
        : (row.fullName
          ? String(row.fullName).split(' ')[0].trim()
          : '');

      const lName = row.lastName
        ? String(row.lastName).trim()
        : (row.fullName
          ? String(row.fullName).split(' ').slice(1).join(' ').trim()
          : '');

      const fullName = row.fullName
        ? String(row.fullName).trim()
        : `${fName} ${lName}`.trim();

      const admissionNo = row.admissionNo
        ? String(row.admissionNo).trim()
        : '';

      const rollNo = row.rollNo
        ? String(row.rollNo).trim()
        : (admissionNo || String(i + 1));

      if (!fName && !fullName) {
        errors.push(
          `CSV Row ${rowNum}: Student name is required.`
        );
        continue;
      }

      if (!admissionNo) {
        errors.push(
          `CSV Row ${rowNum} (${fullName}): Admission number is required.`
        );
        continue;
      }

      // Resolve branch
      let branchId =
        req.admin.branchAccess !== 'all'
          ? Number(req.admin.branchAccess)
          : null;

      if (req.admin.branchAccess === 'all' && row.branchId) {
        branchId = parseInt(row.branchId);
      } else if (
        req.admin.branchAccess === 'all' &&
        row.branchName
      ) {
        const branchName = String(row.branchName)
          .toLowerCase()
          .trim();

        const matchedBranch = branchesList.find(
          b =>
            b.name.toLowerCase() === branchName ||
            (
              b.code &&
              b.code.toLowerCase() === branchName
            )
        );

        if (matchedBranch) {
          branchId = matchedBranch.id;
        }
      }

      if (!branchId && branchesList.length > 0) {
        branchId = branchesList[0].id;
      }

      // Resolve class
      let classId = null;

      if (row.classId) {
        classId = parseInt(row.classId);
      } else if (row.className) {
        const targetClass = String(row.className)
          .toLowerCase()
          .trim();

        const targetSection = row.section
          ? String(row.section).toLowerCase().trim()
          : '';

        const matchedClass = classesList.find(c => {
          const matchName =
            c.name.toLowerCase() === targetClass ||
            `${c.name} ${c.section || ''}`
              .toLowerCase()
              .trim() === targetClass;

          if (targetSection) {
            return (
              matchName &&
              (c.section || '').toLowerCase() === targetSection
            );
          }

          return matchName;
        });

        if (matchedClass) {
          classId = matchedClass.id;

          if (!branchId && matchedClass.branch_id) {
            branchId = matchedClass.branch_id;
          }
        }
      }

      let phone = row.phone
        ? String(row.phone).replace(/[^0-9]/g, '')
        : null;

      if (
        phone &&
        phone.length > 10 &&
        phone.startsWith('91')
      ) {
        phone = phone.slice(2);
      }

      let parentPhone = row.parentPhone
        ? String(row.parentPhone).replace(/[^0-9]/g, '')
        : null;

      if (
        parentPhone &&
        parentPhone.length > 10 &&
        parentPhone.startsWith('91')
      ) {
        parentPhone = parentPhone.slice(2);
      }

      preparedStudents.push({
        orgId,
        classId,
        branchId,
        admissionNo,
        rollNo,
        firstName: fName || fullName,
        lastName: lName || '',
        fullName,
        phone,
        parentName: row.parentName
          ? String(row.parentName).trim()
          : null,
        parentPhone: parentPhone || phone,
        gender: row.gender
          ? String(row.gender).trim()
          : null,
        dateOfBirth: row.dateOfBirth || null
      });
    }

    // Validation errors
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the CSV errors before importing.',
        errors
      });
    }

    // ---------------------------------------------------------
    // 6. Insert only after ALL validation passes
    // ---------------------------------------------------------

    await client.query('BEGIN');

    for (const student of preparedStudents) {
      await client.query(
        `INSERT INTO students (
          org_id,
          class_id,
          branch_id,
          admission_no,
          roll_no,
          roll_number,
          first_name,
          last_name,
          full_name,
          phone,
          parent_name,
          parent_phone,
          gender,
          date_of_birth,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, true
        )`,
        [
          student.orgId,
          student.classId,
          student.branchId,
          student.admissionNo,
          student.rollNo,
          student.rollNo,
          student.firstName,
          student.lastName,
          student.fullName,
          student.phone,
          student.parentName,
          student.parentPhone,
          student.gender,
          student.dateOfBirth
        ]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Successfully imported ${preparedStudents.length} student(s).`,
      importedCount: preparedStudents.length
    });

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error('Students bulk import error:', err);

    // Friendly duplicate error as an additional safety net
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Import failed because an admission number already exists.',
        errors: [
          'One or more admission numbers already exist in this organisation. Please check the Admission No column and try again.'
        ]
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to import students: ' + err.message
    });

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

    let finalBranchId = req.admin.branchAccess !== 'all' ? Number(req.admin.branchAccess) : (branchId || null);
    if (!finalBranchId && classId) {
      const cRes = await pool.query('SELECT branch_id FROM classes WHERE id = $1', [classId]);
      if (cRes.rows.length > 0 && cRes.rows[0].branch_id) {
        finalBranchId = cRes.rows[0].branch_id;
      }
    }

    const rNo = rollNo || cleanAdmissionNo || '';
    const cleanAdmissionNo = admissionNo ? String(admissionNo).trim() : '';

if (!cleanAdmissionNo) {
  return res.status(400).json({
    success: false,
    message: 'Admission number is required.'
  });
}

const duplicateCheck = await pool.query(
  `SELECT id, full_name
   FROM students
   WHERE org_id = $1
     AND admission_no IS NOT NULL
     AND LOWER(TRIM(admission_no)) = LOWER(TRIM($2))
   LIMIT 1`,
  [req.admin.orgId, cleanAdmissionNo]
);

if (duplicateCheck.rows.length > 0) {
  return res.status(409).json({
    success: false,
    message: `Admission number "${cleanAdmissionNo}" is already used. Please enter a different admission number.`
  });
}
    const result = await pool.query(
      `INSERT INTO students (org_id, class_id, branch_id, admission_no, roll_no, roll_number, first_name, last_name, full_name, phone, parent_name, parent_phone, gender, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        req.admin.orgId,
        classId || null,
        finalBranchId,
        cleanAdmissionNo,
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

  // Duplicate Student ID / Admission Number
  if (
    err.code === '23505' &&
    err.constraint &&
    err.constraint.includes('unique_student_admission_per_org')
  ) {
    return res.status(400).json({
      success: false,
      message: 'Student ID already exists. Please enter a different Student ID.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Server error: ' + err.message
  });
}
});

// GET /api/students/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COALESCE(c.name, c.class_name) as class_name, c.section, b.name as branch_name
       FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN branches b ON b.id = s.branch_id
      WHERE s.id = $1 AND s.org_id = $2${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? ' AND s.branch_id = $3' : ''}`,
          req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.params.id, req.admin.orgId, req.admin.branchAccess] : [req.params.id, req.admin.orgId]
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
      WHERE id = $15 AND org_id = $16${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? ' AND branch_id = $17' : ''} RETURNING *`,
          [admissionNo, rNo, rNo, computedFullName, phone, parentName, parentPhone, gender, dateOfBirth, classId, finalBranchId, isActive, fName, lName, req.params.id, req.admin.orgId, ...(req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.admin.branchAccess] : [])]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
  console.error('Student update error:', err);

  // Duplicate Student ID / Admission Number
  if (
    err.code === '23505' &&
    err.constraint &&
    err.constraint.includes('unique_student_admission_per_org')
  ) {
    return res.status(400).json({
      success: false,
      message: 'Student ID already exists. Please enter a different Student ID.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Server error: ' + err.message
  });
}
});

// DELETE /api/students/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM students WHERE id = $1 AND org_id = $2${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? ' AND branch_id = $3' : ''}`,
      req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.params.id, req.admin.orgId, req.admin.branchAccess] : [req.params.id, req.admin.orgId]
    );
    res.json({ success: true, message: 'Student deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
