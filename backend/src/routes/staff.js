const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/staff
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { branch_id, role_type, search } = req.query;
    let query = `
      SELECT s.*, b.name as branch_name,
        (
          SELECT STRING_AGG(
            COALESCE(c.name, c.class_name) || CASE WHEN c.section IS NOT NULL AND c.section != '' THEN ' (' || c.section || ')' ELSE '' END,
            ', ' ORDER BY c.name
          )
          FROM classes c
          WHERE c.teacher_id = s.id
        ) as assigned_classes
      FROM staff s
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE s.org_id = $1`;
    const params = [req.admin.orgId];
    let paramCount = 1;

    if (branch_id) { paramCount++; query += ` AND s.branch_id = $${paramCount}`; params.push(branch_id); }
    if (role_type) { paramCount++; query += ` AND s.role_type = $${paramCount}`; params.push(role_type); }
    if (search) {
      paramCount++;
      query += ` AND (LOWER(s.full_name) LIKE $${paramCount} OR LOWER(s.first_name) LIKE $${paramCount} OR LOWER(s.last_name) LIKE $${paramCount} OR LOWER(s.staff_id) LIKE $${paramCount} OR LOWER(s.username) LIKE $${paramCount} OR s.phone LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    query += ' ORDER BY s.full_name';
    const result = await pool.query(query, params);
    const formattedStaff = result.rows.map(s => {
      const rawStaffId = (s.staff_id && String(s.staff_id).trim() !== '') ? String(s.staff_id).trim() : String(s.id);
      const displayStaffId = rawStaffId.length === 1 ? rawStaffId.padStart(2, '0') : rawStaffId;
      return {
        ...s,
        staff_id: displayStaffId,
        staffId: displayStaffId,
        StaffId: displayStaffId,
        EmployeeId: displayStaffId,
        employeeId: displayStaffId,
        CID: displayStaffId,
        BiometricId: displayStaffId
      };
    });
    res.json({ success: true, staff: formattedStaff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/staff
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      staffId, firstName, lastName, fullName, phone, email, roleType,
      branchId, classId, designation, gender, dateOfJoining, username, password
    } = req.body;

    const fName = firstName ? firstName.trim() : (fullName ? fullName.split(' ')[0] : '');
    const lName = lastName ? lastName.trim() : (fullName ? fullName.split(' ').slice(1).join(' ') : '');
    const computedFullName = `${fName} ${lName}`.trim() || fullName || 'Staff Member';

    if (!fName && !computedFullName) {
      return res.status(400).json({ success: false, message: 'First name is required.' });
    }

    let hashedPassword = null;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Automatically fetch branch latitude, longitude, and geofence radius if branch is assigned
    let lat = '0.00000000';
    let lng = '0.00000000';
    let radius = 100;
    if (branchId) {
      const bRes = await pool.query('SELECT latitude, longitude, geofence_radius FROM branches WHERE id = $1', [branchId]);
      if (bRes.rows.length > 0) {
        lat = bRes.rows[0].latitude || '0.00000000';
        lng = bRes.rows[0].longitude || '0.00000000';
        radius = bRes.rows[0].geofence_radius || 100;
      }
    }

    const result = await pool.query(
      `INSERT INTO staff (
        org_id, branch_id, staff_id, full_name, first_name, last_name, phone, email, role_type,
        designation, gender, date_of_joining, username, password, user_type,
        latitude, longitude, radius_in_meter
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        req.admin.orgId,
        branchId || null,
        staffId || null,
        computedFullName,
        fName,
        lName,
        phone || null,
        email || null,
        roleType || 'teaching',
        designation || null,
        gender || null,
        dateOfJoining || null,
        username || null,
        hashedPassword || null,
        roleType === 'teaching' ? 'Teacher' : 'Staff',
        lat,
        lng,
        radius
      ]
    );

    const createdStaff = result.rows[0];

    // Assign Class to Staff Member if classId is provided
    if (classId) {
      await pool.query(
        'UPDATE classes SET teacher_id = $1 WHERE id = $2 AND org_id = $3',
        [createdStaff.id, classId, req.admin.orgId]
      );
    }

    res.status(201).json({ success: true, staff: createdStaff });
  } catch (err) {
    console.error(err);
    if (err.code === '23505' && err.constraint && err.constraint.includes('username')) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// POST /api/staff/bulk-import - Bulk import staff from CSV
router.post('/bulk-import', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { staff } = req.body;
    const orgId = req.admin.orgId;

    if (!staff || !Array.isArray(staff) || staff.length === 0) {
      return res.status(400).json({ success: false, message: 'No staff records provided for import.' });
    }

    const branchesRes = await client.query('SELECT id, name, code, latitude, longitude, geofence_radius FROM branches WHERE org_id = $1', [orgId]);
    const branchesList = branchesRes.rows;

    let importedCount = 0;
    const errors = [];

    await client.query('BEGIN');

    for (let i = 0; i < staff.length; i++) {
      const row = staff[i];
      const rowNum = i + 1;

      const fName = row.firstName ? String(row.firstName).trim() : (row.fullName ? String(row.fullName).split(' ')[0].trim() : '');
      const lName = row.lastName ? String(row.lastName).trim() : (row.fullName ? String(row.fullName).split(' ').slice(1).join(' ').trim() : '');
      const fullName = row.fullName ? String(row.fullName).trim() : `${fName} ${lName}`.trim();
      const staffId = row.staffId ? String(row.staffId).trim() : '';

      if (!fName && !fullName) {
        errors.push(`Row ${rowNum}: Staff name is required.`);
        continue;
      }
      if (!staffId) {
        errors.push(`Row ${rowNum} (${fullName}): Staff ID is required.`);
        continue;
      }

      // Resolve branch
      let branchId = null;
      let lat = '0.00000000';
      let lng = '0.00000000';
      let radius = 100;
      if (row.branchId) {
        branchId = parseInt(row.branchId);
        const b = branchesList.find(br => br.id === branchId);
        if (b) { lat = b.latitude || lat; lng = b.longitude || lng; radius = b.geofence_radius || radius; }
      } else if (row.branchName) {
        const matchedBranch = branchesList.find(b => 
          b.name.toLowerCase() === String(row.branchName).toLowerCase().trim() ||
          (b.code && b.code.toLowerCase() === String(row.branchName).toLowerCase().trim())
        );
        if (matchedBranch) {
          branchId = matchedBranch.id;
          lat = matchedBranch.latitude || lat;
          lng = matchedBranch.longitude || lng;
          radius = matchedBranch.geofence_radius || radius;
        }
      }
      if (!branchId && branchesList.length > 0) {
        branchId = branchesList[0].id;
        lat = branchesList[0].latitude || lat;
        lng = branchesList[0].longitude || lng;
        radius = branchesList[0].geofence_radius || radius;
      }

      let phone = row.phone ? String(row.phone).replace(/[^0-9]/g, '') : null;
      if (phone && phone.length > 10 && phone.startsWith('91')) phone = phone.slice(2);

      let hashedPassword = null;
      if (row.password && String(row.password).trim() !== '') {
        hashedPassword = await bcrypt.hash(String(row.password).trim(), 10);
      }

      let username = row.username ? String(row.username).trim() : null;
      if (username) {
        const existing = await client.query('SELECT id FROM staff WHERE LOWER(username) = LOWER($1)', [username]);
        if (existing.rows.length > 0) {
          username = `${username}_${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      await client.query(
        `INSERT INTO staff (
          org_id, branch_id, staff_id, full_name, first_name, last_name, phone, email, role_type,
          designation, gender, date_of_joining, username, password, user_type,
          latitude, longitude, radius_in_meter, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true)`,
        [
          orgId,
          branchId,
          staffId,
          fullName,
          fName || fullName,
          lName || '',
          phone,
          row.email ? String(row.email).trim() : null,
          row.roleType || 'teaching',
          row.designation ? String(row.designation).trim() : null,
          row.gender ? String(row.gender).trim() : null,
          row.dateOfJoining || null,
          username,
          hashedPassword,
          (row.roleType || 'teaching') === 'teaching' ? 'Teacher' : 'Staff',
          lat,
          lng,
          radius
        ]
      );
      importedCount++;
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Successfully imported ${importedCount} staff member(s).`,
      importedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Staff bulk import error:', err);
    res.status(500).json({ success: false, message: 'Failed to import staff: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/staff/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, b.name as branch_name,
        (
          SELECT STRING_AGG(
            COALESCE(c.name, c.class_name) || CASE WHEN c.section IS NOT NULL AND c.section != '' THEN ' (' || c.section || ')' ELSE '' END,
            ', ' ORDER BY c.name
          )
          FROM classes c
          WHERE c.teacher_id = s.id
        ) as assigned_classes
       FROM staff s
       LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.id = $1 AND s.org_id = $2`,
      [req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Staff not found.' });
    const s = result.rows[0];
    const rawStaffId = (s.staff_id && String(s.staff_id).trim() !== '') ? String(s.staff_id).trim() : String(s.id);
    const displayStaffId = rawStaffId.length === 1 ? rawStaffId.padStart(2, '0') : rawStaffId;
    const formatted = {
      ...s,
      staff_id: displayStaffId,
      staffId: displayStaffId,
      StaffId: displayStaffId,
      EmployeeId: displayStaffId,
      employeeId: displayStaffId,
      CID: displayStaffId,
      BiometricId: displayStaffId
    };
    res.json({ success: true, staff: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/staff/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      staffId, firstName, lastName, fullName, phone, email, roleType, branchId, classId,
      designation, gender, dateOfJoining, isActive, username, password
    } = req.body;

    const staffMemberId = req.params.id;
    const orgId = req.admin.orgId;

    // Check if username is being changed to one that is already taken by another staff member
    if (username && username.trim() !== '') {
      const existingUser = await pool.query(
        'SELECT id FROM staff WHERE LOWER(username) = LOWER($1) AND id != $2',
        [username.trim(), staffMemberId]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Username is already taken by another staff member.' });
      }
    }

    let hashedPassword = undefined;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

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

    // Automatically update branch latitude, longitude, and geofence radius if branchId is supplied
    let lat = undefined;
    let lng = undefined;
    let radius = undefined;
    if (branchId) {
      const bRes = await pool.query('SELECT latitude, longitude, geofence_radius FROM branches WHERE id = $1', [branchId]);
      if (bRes.rows.length > 0) {
        lat = bRes.rows[0].latitude || '0.00000000';
        lng = bRes.rows[0].longitude || '0.00000000';
        radius = bRes.rows[0].geofence_radius || 100;
      }
    }

    const result = await pool.query(
      `UPDATE staff SET
        staff_id = CASE WHEN $1::text IS NOT NULL THEN $1 ELSE staff_id END,
        full_name = COALESCE($2, full_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        role_type = COALESCE($5, role_type),
        branch_id = COALESCE($6, branch_id),
        designation = COALESCE($7, designation),
        gender = COALESCE($8, gender),
        date_of_joining = COALESCE($9, date_of_joining),
        is_active = COALESCE($10, is_active),
        username = CASE WHEN $11::text IS NOT NULL THEN $11 ELSE username END,
        password = CASE WHEN $12::text IS NOT NULL THEN $12 ELSE password END,
        first_name = COALESCE($13, first_name),
        last_name = COALESCE($14, last_name),
        latitude = COALESCE($15, latitude),
        longitude = COALESCE($16, longitude),
        radius_in_meter = COALESCE($17, radius_in_meter)
       WHERE id = $18 AND org_id = $19 RETURNING *`,
      [
        staffId !== undefined ? staffId.trim() : null,
        computedFullName || null,
        phone || null,
        email || null,
        roleType || null,
        branchId || null,
        designation || null,
        gender || null,
        dateOfJoining || null,
        isActive !== undefined ? isActive : null,
        username !== undefined && username.trim() !== '' ? username.trim() : null,
        hashedPassword || null,
        fName || null,
        lName || null,
        lat || null,
        lng || null,
        radius || null,
        staffMemberId,
        orgId
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Staff not found.' });

    // Manage Class Assignment if provided
    if (classId !== undefined) {
      await pool.query('UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1 AND org_id = $2', [staffMemberId, orgId]);
      if (classId) {
        await pool.query('UPDATE classes SET teacher_id = $1 WHERE id = $2 AND org_id = $3', [staffMemberId, classId, orgId]);
      }
    }

    res.json({ success: true, staff: result.rows[0] });
  } catch (err) {
    console.error('Staff update error:', err);
    if (err.code === '23505' && err.constraint && err.constraint.includes('username')) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// PUT /api/staff/:id/assign-classes
router.put('/:id/assign-classes', authMiddleware, async (req, res) => {
  try {
    const { classIds } = req.body;
    const staffId = req.params.id;

    // Unassign all classes currently assigned to this staff member
    await pool.query('UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1 AND org_id = $2', [staffId, req.admin.orgId]);

    // Assign new selected classes
    if (Array.isArray(classIds) && classIds.length > 0) {
      await pool.query('UPDATE classes SET teacher_id = $1 WHERE id = ANY($2::int[]) AND org_id = $3', [staffId, classIds, req.admin.orgId]);
    }

    res.json({ success: true, message: 'Classes assigned successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    await pool.query('DELETE FROM staff WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Staff deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
