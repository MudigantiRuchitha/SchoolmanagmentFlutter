const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, requireFullAdmin } = require('../middleware/auth');

// ============================================================
// GET /api/classes
// ============================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { branch_id, academic_group_id, academic_year } = req.query;

    let query = `
      SELECT
        c.*,
        ag.name AS academic_group_name,
        b.name AS branch_name,

        (
          SELECT STRING_AGG(
            s.full_name,
            ', '
            ORDER BY s.full_name
          )
          FROM staff s
          WHERE (s.id = ANY(c.teacher_ids)
             OR s.id = c.teacher_id)
            AND (s.is_deleted IS NOT TRUE)
        ) AS teacher_name,

        (
          SELECT COUNT(*)
          FROM students
          WHERE class_id = c.id
            AND is_active = true
            AND (is_deleted IS NOT TRUE)
        ) AS student_count

      FROM classes c

      LEFT JOIN academic_groups ag
        ON ag.id = c.academic_group_id

      LEFT JOIN branches b
        ON b.id = c.branch_id

      WHERE c.org_id = $1
        AND (c.is_deleted IS NOT TRUE)
    `;

    const params = [req.admin.orgId];
    let paramCount = 1;
    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
      paramCount++;
      query += ` AND c.branch_id = $${paramCount}`;
      params.push(req.admin.branchAccess);
    }

    // Filter by branch
    if (branch_id) {
      paramCount++;
      query += ` AND c.branch_id = $${paramCount}`;
      params.push(branch_id);
    }

    // Filter by academic group
    if (academic_group_id) {
      paramCount++;
      query += ` AND c.academic_group_id = $${paramCount}`;
      params.push(academic_group_id);
    }

    // Filter by academic year
    if (academic_year) {
      paramCount++;
      query += ` AND c.academic_year = $${paramCount}`;
      params.push(academic_year);
    }

    query += `
      ORDER BY
        ag.name,
        c.class_name,
        c.name,
        c.section
    `;

    const result = await pool.query(query, params);

    const rows = result.rows;

    // ========================================================
    // UNIQUE CLASS OPTIONS
    //
    // Example:
    //
    // Class 10
    // Class 11
    // Class 12
    //
    // We do NOT show the section here.
    // ========================================================

    const classMap = new Map();

    rows.forEach((c) => {
      const className = String(
        c.class_name || c.name || ''
      ).trim();

      if (!className) return;

      if (!classMap.has(className)) {
        classMap.set(className, {
          className: className
        });
      }
    });

    const classOptions = Array.from(classMap.values());

    // ========================================================
    // SECTIONS BY CLASS
    //
    // Example:
    //
    // {
    //   "Class 10": [
    //      { section: "A", classId: 4 }
    //   ],
    //
    //   "Class 11": [
    //      { section: "A", classId: 6 }
    //   ]
    // }
    // ========================================================

    const sectionsByClass = {};

    rows.forEach((c) => {
      const className = String(
        c.class_name || c.name || ''
      ).trim();

      const section = String(
        c.section || ''
      ).trim();

      if (!className) return;

      if (!sectionsByClass[className]) {
        sectionsByClass[className] = [];
      }

      // Avoid duplicate section entries
      const alreadyExists = sectionsByClass[className].some(
        (item) => item.section === section
      );

      if (!alreadyExists && section) {
        sectionsByClass[className].push({
          section: section,
          classId: c.id
        });
      }
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    res.json({
      success: true,

      // Existing response.
      // Keeping this so existing frontend code does not break.
      classes: rows,

      // New unique class dropdown data.
      classOptions: classOptions,

      // Sections belonging to each class.
      sectionsByClass: sectionsByClass
    });

  } catch (err) {
    console.error('GET /api/classes error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
});


// ============================================================
// POST /api/classes
// ============================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      section,
      academicGroupId,
      branchId,
      academicYear,
      teacherId,
      teacherIds
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Class name is required.'
      });
    }

    if (!section || !section.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Section is required.'
      });
    }

    const scopedBranchId = req.admin.branchAccess && req.admin.branchAccess !== 'all'
      ? Number(req.admin.branchAccess)
      : (branchId ? Number(branchId) : null);

    if (!scopedBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch is required.'
      });
    }

    const trimmedAcademicYear = (academicYear || '').trim();
    if (!trimmedAcademicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic Year is required.'
      });
    }

    let idsArray = [];

    if (Array.isArray(teacherIds)) {
      idsArray = teacherIds
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));

    } else if (Array.isArray(teacherId)) {
      idsArray = teacherId
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));

    } else if (teacherId) {
      const parsedTeacherId = parseInt(teacherId);

      if (!isNaN(parsedTeacherId)) {
        idsArray = [parsedTeacherId];
      }
    }

    const primaryId =
      idsArray.length > 0
        ? idsArray[0]
        : null;

    if (!primaryId) {
      return res.status(400).json({
        success: false,
        message: 'Assigned Staff is required.'
      });
    }

    const trimmedName = name.trim();
    const trimmedSection = section.trim();

    // Check if class with same name and section already exists in this branch / org / academic_year
    const duplicateCheck = await pool.query(
      `
      SELECT id FROM classes
      WHERE org_id = $1
        AND (is_deleted IS NOT TRUE)
        AND (
          $2::int IS NULL
          OR branch_id = $2::int
          OR branch_id IS NULL
        )
        AND (
          REGEXP_REPLACE(LOWER(COALESCE(class_name, name)), '[^a-z0-9]', '', 'g') = REGEXP_REPLACE(LOWER($3), '[^a-z0-9]', '', 'g')
          OR
          TRIM(TRAILING REGEXP_REPLACE(LOWER($4), '[^a-z0-9]', '', 'g') FROM REGEXP_REPLACE(LOWER(COALESCE(class_name, name)), '[^a-z0-9]', '', 'g'))
          =
          TRIM(TRAILING REGEXP_REPLACE(LOWER($4), '[^a-z0-9]', '', 'g') FROM REGEXP_REPLACE(LOWER($3), '[^a-z0-9]', '', 'g'))
        )
        AND REGEXP_REPLACE(LOWER(COALESCE(section, '')), '[^a-z0-9]', '', 'g') = REGEXP_REPLACE(LOWER($4), '[^a-z0-9]', '', 'g')
        AND (
          $5::text IS NULL
          OR academic_year IS NULL
          OR academic_year = $5::text
        )
      LIMIT 1
      `,
      [
        req.admin.orgId,
        scopedBranchId,
        trimmedName,
        trimmedSection,
        trimmedAcademicYear
      ]
    );

    if (duplicateCheck.rows.length > 0) {
      const secMsg = trimmedSection ? ` with section "${trimmedSection}"` : '';
      return res.status(400).json({
        success: false,
        message: `Class "${trimmedName}"${secMsg} already exists in this branch and academic year.`
      });
    }

    const result = await pool.query(
      `
      INSERT INTO classes (
        org_id,
        name,
        class_name,
        section,
        academic_group_id,
        branch_id,
        academic_year,
        teacher_id,
        teacher_ids
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        req.admin.orgId,
        trimmedName,
        trimmedName,
        trimmedSection || null,
        academicGroupId || null,
        scopedBranchId,
        trimmedAcademicYear,
        primaryId,
        idsArray
      ]
    );

    res.status(201).json({
      success: true,
      class: result.rows[0]
    });

  } catch (err) {
    console.error('POST /api/classes error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
});


// ============================================================
// PUT /api/classes/:id
// ============================================================
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      section,
      academicGroupId,
      branchId,
      academicYear,
      teacherId,
      teacherIds,
      isActive
    } = req.body;

    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID.'
      });
    }

    // Fetch existing class
    const existingResult = await pool.query(
      `SELECT * FROM classes WHERE id = $1 AND org_id = $2`,
      [classId, req.admin.orgId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found.'
      });
    }

    const currentClass = existingResult.rows[0];

    if (branchId !== undefined && (branchId === null || String(branchId).trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Branch is required.'
      });
    }

    if (academicYear !== undefined && (academicYear === null || String(academicYear).trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Academic Year is required.'
      });
    }

    let idsArray = undefined;

    if (Array.isArray(teacherIds)) {
      idsArray = teacherIds
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));

    } else if (Array.isArray(teacherId)) {
      idsArray = teacherId
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));

    } else if (teacherId !== undefined) {
      if (teacherId) {
        const parsedTeacherId = parseInt(teacherId);

        idsArray = !isNaN(parsedTeacherId)
          ? [parsedTeacherId]
          : [];
      } else {
        idsArray = [];
      }
    }

    const primaryId =
      idsArray !== undefined
        ? (
            idsArray.length > 0
              ? idsArray[0]
              : null
          )
        : undefined;

    if (idsArray !== undefined && idsArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assigned Staff is required.'
      });
    }

    const scopedBranchId = req.admin.branchAccess && req.admin.branchAccess !== 'all'
      ? Number(req.admin.branchAccess)
      : (branchId !== undefined ? (branchId ? Number(branchId) : null) : currentClass.branch_id);

    const targetName = name !== undefined && name !== null ? String(name).trim() : (currentClass.class_name || currentClass.name || '').trim();
    const targetSection = section !== undefined && section !== null ? String(section).trim() : (currentClass.section || '').trim();
    const targetAcademicYear = academicYear !== undefined && academicYear !== null ? String(academicYear).trim() : (currentClass.academic_year || '').trim();

    // Check duplicate if name, section, branchId, or academicYear is modified
    if (name !== undefined || section !== undefined || branchId !== undefined || academicYear !== undefined) {
      const duplicateCheck = await pool.query(
        `
        SELECT id FROM classes
        WHERE org_id = $1
          AND (is_deleted IS NOT TRUE)
          AND (
            $2::int IS NULL
            OR branch_id = $2::int
            OR branch_id IS NULL
          )
          AND (
            REGEXP_REPLACE(LOWER(COALESCE(class_name, name)), '[^a-z0-9]', '', 'g') = REGEXP_REPLACE(LOWER($3), '[^a-z0-9]', '', 'g')
            OR
            TRIM(TRAILING REGEXP_REPLACE(LOWER($4), '[^a-z0-9]', '', 'g') FROM REGEXP_REPLACE(LOWER(COALESCE(class_name, name)), '[^a-z0-9]', '', 'g'))
            =
            TRIM(TRAILING REGEXP_REPLACE(LOWER($4), '[^a-z0-9]', '', 'g') FROM REGEXP_REPLACE(LOWER($3), '[^a-z0-9]', '', 'g'))
          )
          AND REGEXP_REPLACE(LOWER(COALESCE(section, '')), '[^a-z0-9]', '', 'g') = REGEXP_REPLACE(LOWER($4), '[^a-z0-9]', '', 'g')
          AND (
            $5::text IS NULL
            OR academic_year IS NULL
            OR academic_year = $5::text
          )
          AND id != $6
        LIMIT 1
        `,
        [
          req.admin.orgId,
          scopedBranchId,
          targetName,
          targetSection,
          targetAcademicYear || null,
          classId
        ]
      );

      if (duplicateCheck.rows.length > 0) {
        const secMsg = targetSection ? ` with section "${targetSection}"` : '';
        return res.status(400).json({
          success: false,
          message: `Class "${targetName}"${secMsg} already exists in this branch and academic year.`
        });
      }
    }

    const result = await pool.query(
      `
      UPDATE classes
      SET
        name = COALESCE($1, name),
        class_name = COALESCE($1, class_name),
        section = COALESCE($2, section),
        academic_group_id = COALESCE($3, academic_group_id),
        branch_id = COALESCE($4, branch_id),
        academic_year = COALESCE($5, academic_year),
        teacher_id =
          CASE
            WHEN $6::boolean
            THEN $7::integer
            ELSE teacher_id
          END,
        teacher_ids =
          CASE
            WHEN $6::boolean
            THEN $8::integer[]
            ELSE teacher_ids
          END,
        is_active = COALESCE($9, is_active)
      WHERE id = $10
        AND org_id = $11
        ${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? 'AND branch_id = $12' : ''}
      RETURNING *
      `,
      [
        name || null,
        section || null,
        academicGroupId || null,
        scopedBranchId || null,
        targetAcademicYear || null,
        idsArray !== undefined,
        primaryId !== undefined ? primaryId : null,
        idsArray !== undefined ? idsArray : null,
        isActive !== undefined ? isActive : null,
        req.params.id,
        req.admin.orgId,
        ...(req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.admin.branchAccess] : [])
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found.'
      });
    }

    res.json({
      success: true,
      class: result.rows[0]
    });

  } catch (err) {
    console.error('PUT /api/classes/:id error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
});


// ============================================================
// PUT /api/classes/:id/assign-staff
// ============================================================
router.put('/:id/assign-staff', authMiddleware, async (req, res) => {
  try {
    const { teacherIds } = req.body;

    const classId = req.params.id;

    const idsArray = Array.isArray(teacherIds)
      ? teacherIds
          .map(id => parseInt(id))
          .filter(id => !isNaN(id))
      : [];

    const primaryId =
      idsArray.length > 0
        ? idsArray[0]
        : null;

    await pool.query(
      `
      UPDATE classes
      SET
        teacher_ids = $1,
        teacher_id = $2
      WHERE id = $3
        AND org_id = $4
        ${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? 'AND branch_id = $5' : ''}
      `,
      [
        idsArray,
        primaryId,
        classId,
        req.admin.orgId,
        ...(req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.admin.branchAccess] : [])
      ]
    );

    res.json({
      success: true,
      message: 'Staff assigned to class successfully.'
    });

  } catch (err) {
    console.error(
      'PUT /api/classes/:id/assign-staff error:',
      err
    );

    res.status(500).json({
      success: false,
      message: 'Server error: ' + err.message
    });
  }
});


// ============================================================
// DELETE /api/classes/:id
// ============================================================
router.delete('/:id', authMiddleware, requireFullAdmin, async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE classes
      SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND org_id = $2
        ${req.admin.branchAccess && req.admin.branchAccess !== 'all' ? 'AND branch_id = $3' : ''}
      `,
      [
        req.params.id,
        req.admin.orgId,
        ...(req.admin.branchAccess && req.admin.branchAccess !== 'all' ? [req.admin.branchAccess] : [])
      ]
    );

    res.json({
      success: true,
      message: 'Class deleted.'
    });

  } catch (err) {
    console.error(
      'DELETE /api/classes/:id error:',
      err
    );

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
});


module.exports = router;