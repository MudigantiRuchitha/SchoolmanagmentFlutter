const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/branches
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT b.*, 
        (SELECT COUNT(*) FROM students WHERE branch_id = b.id AND is_active = true) as student_count,
        (SELECT COUNT(*) FROM staff WHERE branch_id = b.id AND is_active = true) as staff_count,
        (SELECT COUNT(*) FROM classes WHERE branch_id = b.id AND is_active = true) as class_count
       FROM branches b 
       WHERE b.org_id = $1
    `;
    const params = [req.admin.orgId];

    if (status === 'active') {
      query += ` AND b.is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND b.is_active = false`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (b.name ILIKE $${params.length} OR b.code ILIKE $${params.length} OR b.contact_person ILIKE $${params.length} OR b.phone ILIKE $${params.length})`;
    }

    query += ` ORDER BY b.name`;

    const result = await pool.query(query, params);
    res.json({ success: true, branches: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/branches/:id/details
router.get('/:id/details', authMiddleware, async (req, res) => {
  try {
    const branchRes = await pool.query(
      'SELECT * FROM branches WHERE id = $1 AND org_id = $2',
      [req.params.id, req.admin.orgId]
    );
    if (branchRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Branch not found.' });

    const [classesRes, staffRes, studentsRes, adminsRes] = await Promise.all([
      pool.query('SELECT c.*, ag.name as academic_group_name FROM classes c LEFT JOIN academic_groups ag ON ag.id = c.academic_group_id WHERE c.branch_id = $1 AND c.org_id = $2 ORDER BY c.name', [req.params.id, req.admin.orgId]),
      pool.query('SELECT id, staff_id, full_name, role_type, designation, phone, email, is_active FROM staff WHERE branch_id = $1 AND org_id = $2 ORDER BY full_name', [req.params.id, req.admin.orgId]),
      pool.query('SELECT s.id, s.admission_no, s.roll_no, s.full_name, c.name as class_name, c.section, s.parent_name, s.phone FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.branch_id = $1 AND s.org_id = $2 ORDER BY s.full_name LIMIT 50', [req.params.id, req.admin.orgId]),
      pool.query("SELECT id, username, full_name, email, role, is_active FROM admin_users WHERE org_id = $1 AND (branch_access = $2 OR branch_access = 'all')", [req.admin.orgId, req.params.id.toString()]),
    ]);

    res.json({
      success: true,
      branch: branchRes.rows[0],
      classes: classesRes.rows,
      staff: staffRes.rows,
      students: studentsRes.rows,
      admins: adminsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/branches
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      name, code, contactPerson, phone, email, address, latitude, longitude, geofenceRadius,
      createBranchAdmin, adminUsername, adminPassword, adminFullName, adminEmail, adminPhone 
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required.' });

    const branchResult = await pool.query(
      `INSERT INTO branches (org_id, name, code, contact_person, phone, email, address, latitude, longitude, geofence_radius) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.admin.orgId, 
        name, 
        code || null, 
        contactPerson || null, 
        phone || null, 
        email || null, 
        address || null,
        latitude || null,
        longitude || null,
        geofenceRadius ? parseInt(geofenceRadius) : 100
      ]
    );

    const newBranch = branchResult.rows[0];
    let createdAdmin = null;

    // Optional Branch Admin Creation
    if (createBranchAdmin && adminUsername && adminPassword) {
      const existing = await pool.query('SELECT id FROM admin_users WHERE org_id = $1 AND LOWER(username) = LOWER($2)', [req.admin.orgId, adminUsername]);
      if (existing.rows.length === 0) {
        const hash = await bcrypt.hash(adminPassword, 10);
        const adminRes = await pool.query(
          `INSERT INTO admin_users (org_id, username, password_hash, full_name, email, phone, role, branch_access)
           VALUES ($1, $2, $3, $4, $5, $6, 'admin', $7) RETURNING id, username, full_name, email, role, branch_access`,
          [req.admin.orgId, adminUsername, hash, adminFullName || null, adminEmail || null, adminPhone || null, newBranch.id.toString()]
        );
        createdAdmin = adminRes.rows[0];
      }
    }

    res.status(201).json({ success: true, branch: newBranch, admin: createdAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/branches/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, code, contactPerson, phone, email, address, latitude, longitude, geofenceRadius, isActive } = req.body;
    const result = await pool.query(
      `UPDATE branches SET 
        name = COALESCE($1, name), 
        code = COALESCE($2, code),
        contact_person = COALESCE($3, contact_person), 
        phone = COALESCE($4, phone),
        email = COALESCE($5, email), 
        address = COALESCE($6, address),
        latitude = COALESCE($7, latitude),
        longitude = COALESCE($8, longitude),
        geofence_radius = COALESCE($9, geofence_radius),
        is_active = COALESCE($10, is_active)
       WHERE id = $11 AND org_id = $12 RETURNING *`,
      [
        name, code, contactPerson, phone, email, address, 
        latitude, longitude, geofenceRadius ? parseInt(geofenceRadius) : undefined, 
        isActive, req.params.id, req.admin.orgId
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, branch: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/branches/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM branches WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Branch deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
