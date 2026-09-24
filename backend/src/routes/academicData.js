const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// ============================================================
// GET /api/academic-data/years
// Fetches distinct academic years available for the organization
// ============================================================
router.get('/years', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const query = `
      SELECT DISTINCT academic_year FROM (
        SELECT academic_year FROM classes WHERE org_id = $1 AND academic_year IS NOT NULL AND TRIM(academic_year) != ''
        UNION
        SELECT academic_year FROM staff WHERE org_id = $1 AND academic_year IS NOT NULL AND TRIM(academic_year) != ''
      ) years
      ORDER BY academic_year DESC
    `;

    const result = await pool.query(query, [orgId]);
    // Only return years actually present in the database — no hard-coded fallbacks
    const dbYears = result.rows
      .map(r => r.academic_year.trim())
      .filter(Boolean);

    res.json({
      success: true,
      academicYears: dbYears
    });

  } catch (err) {
    console.error('GET /api/academic-data/years error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch academic years.' });
  }
});

// ============================================================
// GET /api/academic-data/classes
// Fetches unique classes and their sections for an academic year
// ============================================================
router.get('/classes', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const { academic_year } = req.query;

    let query = `
      SELECT id, name, class_name, section, academic_year, branch_id
      FROM classes
      WHERE org_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    // Filter by branchAccess if restricted
    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
      paramCount++;
      query += ` AND branch_id = $${paramCount}`;
      params.push(req.admin.branchAccess);
    }

    if (academic_year) {
      paramCount++;
      query += ` AND (academic_year = $${paramCount} OR academic_year IS NULL)`;
      params.push(academic_year);
    }

    query += ` ORDER BY name, class_name, section`;

    const result = await pool.query(query, params);
    const rows = result.rows;

    const classMap = new Map();
    rows.forEach(c => {
      const className = String(c.class_name || c.name || '').trim();
      if (!className) return;

      if (!classMap.has(className)) {
        classMap.set(className, {
          className,
          sections: []
        });
      }

      const section = String(c.section || '').trim();
      if (section && !classMap.get(className).sections.includes(section)) {
        classMap.get(className).sections.push(section);
      }
    });

    const classes = Array.from(classMap.values()).map(c => ({
      className: c.className,
      sections: c.sections.sort()
    }));

    res.json({
      success: true,
      classes,
      rawClasses: rows
    });
  } catch (err) {
    console.error('GET /api/academic-data/classes error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch classes.' });
  }
});

// ============================================================
// GET /api/academic-data/students
// Fetches students matching academic year, class name, and section
// ============================================================
router.get('/students', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const { academic_year, class_name, section, search } = req.query;

    let query = `
      SELECT 
        s.id,
        COALESCE(s.admission_no, s.roll_no, s.roll_number, '—') AS admission_no,
        COALESCE(
          CASE 
            WHEN s.first_name IS NOT NULL AND s.first_name != '' THEN TRIM(s.first_name || ' ' || COALESCE(s.last_name, ''))
            ELSE s.full_name
          END,
          '—'
        ) AS student_name,
        COALESCE(c.class_name, c.name, '—') AS class_name,
        COALESCE(c.section, '—') AS section,
        COALESCE(s.gender, '—') AS gender,
        COALESCE(s.parent_name, '—') AS parent_guardian,
        COALESCE(s.parent_phone, s.parent_contact, s.phone, '—') AS contact,
        s.is_active AS status,
        COALESCE(c.academic_year, '2026-2027') AS academic_year,
        b.name AS branch_name
      FROM students s
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE s.org_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    // Dedicated branch access check
    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
      paramCount++;
      query += ` AND s.branch_id = $${paramCount}`;
      params.push(req.admin.branchAccess);
    }

    if (academic_year) {
      paramCount++;
      query += ` AND (c.academic_year = $${paramCount} OR c.academic_year IS NULL)`;
      params.push(academic_year);
    }

    if (class_name) {
      paramCount++;
      query += ` AND (LOWER(COALESCE(c.class_name, c.name)) = LOWER($${paramCount}))`;
      params.push(class_name.trim());
    }

    if (section) {
      paramCount++;
      query += ` AND (LOWER(COALESCE(c.section, '')) = LOWER($${paramCount}))`;
      params.push(section.trim());
    }

    if (search) {
      paramCount++;
      query += ` AND (
        LOWER(s.full_name) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.first_name, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.last_name, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.admission_no, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.roll_no, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.phone, '')) LIKE $${paramCount} OR
        LOWER(COALESCE(s.parent_name, '')) LIKE $${paramCount}
      )`;
      params.push(`%${search.toLowerCase().trim()}%`);
    }

    query += ` ORDER BY c.name, c.section, s.roll_no, s.full_name`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      students: result.rows
    });
  } catch (err) {
    console.error('GET /api/academic-data/students error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch academic students.' });
  }
});

// ============================================================
// GET /api/academic-data/staff
// Fetches staff matching academic year and staff type (teaching / non-teaching)
// ============================================================
router.get('/staff', authMiddleware, async (req, res) => {
  try {
    const orgId = req.admin.orgId;
    const { academic_year, staff_type, search } = req.query;

    const isNonTeaching = staff_type && staff_type.toLowerCase() === 'non-teaching';

    let query = '';
    const params = [orgId];
    let paramCount = 1;

    if (isNonTeaching) {
      // Non-Teaching Staff Query: Employee ID, Name, Department, Designation, Contact, Status
      query = `
        SELECT
          s.id,
          COALESCE(s.staff_id, s.id::text) AS employee_id,
          COALESCE(
            CASE 
              WHEN s.first_name IS NOT NULL AND s.first_name != '' THEN TRIM(s.first_name || ' ' || COALESCE(s.last_name, ''))
              ELSE s.full_name
            END,
            '—'
          ) AS name,
          COALESCE(s.department, 'Administration') AS department,
          COALESCE(s.designation, 'Staff') AS designation,
          COALESCE(s.phone, s.email, '—') AS contact,
          s.is_active AS status,
          s.role_type,
          COALESCE(s.academic_year, '2026-2027') AS academic_year,
          b.name AS branch_name
        FROM staff s
        LEFT JOIN branches b ON b.id = s.branch_id
        WHERE s.org_id = $1
          AND (s.role_type = 'non-teaching' OR s.role_type = 'management')
      `;
    } else {
      // Teaching Staff Query: Employee ID, Name, Subject, Department, Designation, Class, Section, Contact, Status
      query = `
        SELECT
          s.id,
          COALESCE(s.staff_id, s.id::text) AS employee_id,
          COALESCE(
            CASE 
              WHEN s.first_name IS NOT NULL AND s.first_name != '' THEN TRIM(s.first_name || ' ' || COALESCE(s.last_name, ''))
              ELSE s.full_name
            END,
            '—'
          ) AS name,
          COALESCE(
            s.subject,
            (
              SELECT STRING_AGG(DISTINCT c.subject, ', ') 
              FROM classes c 
              WHERE (c.teacher_id = s.id OR (c.teacher_ids IS NOT NULL AND s.id = ANY(c.teacher_ids)))
                AND c.subject IS NOT NULL AND c.subject != ''
            ),
            'General'
          ) AS subject,
          COALESCE(s.department, 'Academics') AS department,
          COALESCE(s.designation, 'Teacher') AS designation,
          COALESCE(
            (
              SELECT STRING_AGG(DISTINCT COALESCE(c.class_name, c.name), ', ')
              FROM classes c
              WHERE (c.teacher_id = s.id OR (c.teacher_ids IS NOT NULL AND s.id = ANY(c.teacher_ids)))
            ),
            '—'
          ) AS class_name,
          COALESCE(
            (
              SELECT STRING_AGG(DISTINCT c.section, ', ')
              FROM classes c
              WHERE (c.teacher_id = s.id OR (c.teacher_ids IS NOT NULL AND s.id = ANY(c.teacher_ids)))
                AND c.section IS NOT NULL AND c.section != ''
            ),
            '—'
          ) AS section,
          COALESCE(s.phone, s.email, '—') AS contact,
          s.is_active AS status,
          s.role_type,
          COALESCE(s.academic_year, '2026-2027') AS academic_year,
          b.name AS branch_name
        FROM staff s
        LEFT JOIN branches b ON b.id = s.branch_id
        WHERE s.org_id = $1
          AND (s.role_type = 'teaching' OR s.role_type IS NULL)
      `;
    }

    // Branch access check
    if (req.admin.branchAccess && req.admin.branchAccess !== 'all') {
      paramCount++;
      query += ` AND s.branch_id = $${paramCount}`;
      params.push(req.admin.branchAccess);
    }

    if (academic_year) {
      paramCount++;
      query += ` AND (s.academic_year = $${paramCount} OR s.academic_year IS NULL)`;
      params.push(academic_year);
    }

    if (search) {
      paramCount++;
      query += ` AND (
        LOWER(s.full_name) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.staff_id, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.designation, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.department, '')) LIKE $${paramCount} OR 
        LOWER(COALESCE(s.phone, '')) LIKE $${paramCount}
      )`;
      params.push(`%${search.toLowerCase().trim()}%`);
    }

    query += ` ORDER BY s.full_name`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      staff: result.rows
    });
  } catch (err) {
    console.error('GET /api/academic-data/staff error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch academic staff.' });
  }
});

module.exports = router;
