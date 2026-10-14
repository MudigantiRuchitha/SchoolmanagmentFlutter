const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authMiddleware, requireFullAdmin } = require('../middleware/auth');

// ============================================================
// GET /api/staff
// ============================================================
router.get('/', authMiddleware, async (req, res) => {

  // IMPORTANT DEBUG
  console.log('');
  console.log('🔥 STAFF API WAS CALLED');
  console.log('==========================================');

  try {
    const { branch_id, role_type, search } = req.query;

    // ========================================================
    // DATABASE DEBUG
    // ========================================================
    console.log('Admin Org ID:', req.admin.orgId);

    const dbCheck = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        current_user AS database_user,
        inet_server_addr() AS server_address,
        inet_server_port() AS server_port
    `);

    console.log('BACKEND DATABASE:');
    console.log(dbCheck.rows[0]);

    const staffCheck = await pool.query(`
      SELECT
        id,
        org_id,
        staff_id,
        full_name,
        username,
        branch_id
      FROM public.staff
      ORDER BY id
    `);

    console.log('BACKEND STAFF TABLE:');
    console.table(staffCheck.rows);

    console.log('==========================================');

    // ========================================================
    // BUILD QUERY
    // ========================================================
    let query = `
      SELECT s.*, b.name as branch_name,
        (
          SELECT STRING_AGG(
            COALESCE(c.name, c.class_name) ||
            CASE
              WHEN c.section IS NOT NULL AND c.section != ''
              THEN ' (' || c.section || ')'
              ELSE ''
            END,
            ', ' ORDER BY c.name
          )
          FROM classes c
          WHERE c.teacher_id = s.id
            AND (c.is_deleted IS NOT TRUE)
        ) as assigned_classes
      FROM staff s
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE s.org_id = $1
        AND (s.is_deleted IS NOT TRUE)
    `;

    const params = [req.admin.orgId];
    let paramCount = 1;

    // ========================================================
    // BRANCH ACCESS
    // ========================================================
    if (
      req.admin.branchAccess &&
      req.admin.branchAccess !== 'all'
    ) {
      paramCount++;

      query += `
        AND s.branch_id = $${paramCount}
      `;

      params.push(req.admin.branchAccess);
    }

    // ========================================================
    // BRANCH FILTER
    // ========================================================
    if (branch_id) {
      paramCount++;

      query += `
        AND s.branch_id = $${paramCount}
      `;

      params.push(branch_id);
    }

    // ========================================================
    // ROLE FILTER
    // ========================================================
    if (role_type) {
      paramCount++;

      query += `
        AND s.role_type = $${paramCount}
      `;

      params.push(role_type);
    }

    // ========================================================
    // SEARCH
    // ========================================================
    if (search) {
      paramCount++;

      query += `
        AND (
          LOWER(s.full_name) LIKE $${paramCount}
          OR LOWER(s.first_name) LIKE $${paramCount}
          OR LOWER(s.last_name) LIKE $${paramCount}
          OR LOWER(s.staff_id) LIKE $${paramCount}
          OR LOWER(s.username) LIKE $${paramCount}
          OR s.phone LIKE $${paramCount}
        )
      `;

      params.push(
        `%${search.toLowerCase()}%`
      );
    }

    // ========================================================
    // ORDER
    // ========================================================
    query += `
      ORDER BY s.full_name
    `;

    // ========================================================
    // EXECUTE STAFF QUERY
    // ========================================================
    console.log('STAFF QUERY ORG ID:', req.admin.orgId);

    const result = await pool.query(
      query,
      params
    );

    console.log(
      'STAFF API RESULT COUNT:',
      result.rows.length
    );

    console.log('STAFF API RESULT:');

    console.table(
      result.rows.map(row => ({
        id: row.id,
        org_id: row.org_id,
        staff_id: row.staff_id,
        full_name: row.full_name,
        username: row.username,
        branch_id: row.branch_id
      }))
    );

    // ========================================================
    // FORMAT STAFF ID
    // ========================================================
    const formattedStaff =
      result.rows.map(s => {

        const rawStaffId =
          s.staff_id &&
          String(s.staff_id).trim() !== ''
            ? String(s.staff_id).trim()
            : String(s.id);

        const displayStaffId =
          rawStaffId.length === 1
            ? rawStaffId.padStart(2, '0')
            : rawStaffId;

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

    // ========================================================
    // RESPONSE
    // ========================================================
    res.json({
      success: true,
      staff: formattedStaff
    });

  } catch (err) {

    console.error(
      'Get staff error:',
      err
    );

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
});


// ============================================================
// POST /api/staff
// ADD STAFF
// ============================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      staffId,
      firstName,
      lastName,
      fullName,
      phone,
      email,
      roleType,
      branchId,
      classId,
      designation,
      gender,
      dateOfJoining,
      username,
      password,
      expectedCheckIn,
      expectedCheckOut
    } = req.body;

    // --------------------------------------------------------
    // CLEAN STAFF ID
    // --------------------------------------------------------
    const cleanStaffId =
      staffId !== undefined &&
      staffId !== null
        ? String(staffId).trim()
        : '';

    // --------------------------------------------------------
    // REQUIRED STAFF ID
    // --------------------------------------------------------
    if (!cleanStaffId) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID is required.'
      });
    }

    // --------------------------------------------------------
// CHECK DUPLICATE STAFF ID
// --------------------------------------------------------
const existingStaff = await pool.query(
  `
    SELECT id, full_name, staff_id
    FROM staff
    WHERE org_id = $1
      AND staff_id IS NOT NULL
      AND TRIM(staff_id) <> ''
      AND LOWER(TRIM(staff_id)) =
          LOWER(TRIM($2))
    LIMIT 1
  `,
  [
    req.admin.orgId,
    cleanStaffId
  ]
);

if (existingStaff.rows.length > 0) {
  return res.status(409).json({
    success: false,
    duplicate: true,
    message: `Staff ID "${cleanStaffId}" already exists. Please use a unique Staff ID.`,
    existingStaff: existingStaff.rows[0]
  });
}
    // --------------------------------------------------------
    // CHECK DUPLICATE USERNAME
    // --------------------------------------------------------
    if (username && username.trim() !== '') {
      const existingUsername = await pool.query(
        `
          SELECT id
          FROM staff
          WHERE LOWER(TRIM(username)) =
                LOWER(TRIM($1))
          LIMIT 1
        `,
        [username.trim()]
      );

      if (existingUsername.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken.'
        });
      }
    }

    // --------------------------------------------------------
    // BRANCH ACCESS
    // --------------------------------------------------------
    const scopedBranchId =
      req.admin.branchAccess !== 'all'
        ? Number(req.admin.branchAccess)
        : branchId || null;

    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------
    const fName = firstName
      ? firstName.trim()
      : (
          fullName
            ? fullName.split(' ')[0]
            : ''
        );

    const lName = lastName
      ? lastName.trim()
      : (
          fullName
            ? fullName.split(' ').slice(1).join(' ')
            : ''
        );

    const computedFullName =
      `${fName} ${lName}`.trim() ||
      fullName ||
      'Staff Member';

    if (!fName && !computedFullName) {
      return res.status(400).json({
        success: false,
        message: 'First name is required.'
      });
    }

    // --------------------------------------------------------
    // PASSWORD
    // --------------------------------------------------------
    let hashedPassword = null;

    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // --------------------------------------------------------
    // BRANCH LOCATION
    // --------------------------------------------------------
    let lat = '0.00000000';
    let lng = '0.00000000';
    let radius = 100;

    if (scopedBranchId) {
      const bRes = await pool.query(
        `
          SELECT latitude, longitude, geofence_radius
          FROM branches
          WHERE id = $1
        `,
        [scopedBranchId]
      );

      if (bRes.rows.length > 0) {
        lat =
          bRes.rows[0].latitude ||
          '0.00000000';

        lng =
          bRes.rows[0].longitude ||
          '0.00000000';

        radius =
          bRes.rows[0].geofence_radius ||
          100;
      }
    }

    // --------------------------------------------------------
    // INSERT STAFF
    // --------------------------------------------------------
    const expCheckIn = expectedCheckIn || req.body.expected_check_in || '09:00:00';
    const expCheckOut = expectedCheckOut || req.body.expected_check_out || '17:00:00';
    
    const result = await pool.query(
      `
        INSERT INTO staff (
          org_id,
          branch_id,
          staff_id,
          full_name,
          first_name,
          last_name,
          phone,
          email,
          role_type,
          designation,
          gender,
          date_of_joining,
          username,
          password,
          user_type,
          latitude,
          longitude,
          radius_in_meter,
          expected_check_in,
          expected_check_out
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20
        )
        RETURNING *
      `,
      [
        req.admin.orgId,
        scopedBranchId,
        cleanStaffId,
        computedFullName,
        fName,
        lName,
        phone || null,
        email || null,
        roleType || 'teaching',
        designation || null,
        gender || null,
        dateOfJoining || null,
        username && username.trim()
          ? username.trim()
          : null,
        hashedPassword || null,
        roleType === 'teaching'
          ? 'Teacher'
          : 'Staff',
        lat,
        lng,
        radius,
        expCheckIn,
        expCheckOut
      ]
    );

    const createdStaff = result.rows[0];

    // --------------------------------------------------------
    // ASSIGN CLASS
    // --------------------------------------------------------
    if (classId) {
      await pool.query(
        `
          UPDATE classes
          SET teacher_id = $1
          WHERE id = $2
            AND org_id = $3
        `,
        [
          createdStaff.id,
          classId,
          req.admin.orgId
        ]
      );
    }

    res.status(201).json({
      success: true,
      staff: createdStaff
    });

  } catch (err) {
    console.error('Add staff error:', err);

    if (
      err.code === '23505' &&
      err.constraint &&
      err.constraint.includes('unique_staff_id_per_org')
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Staff ID already exists. Please enter a different Staff ID.'
      });
    }

    if (
      err.code === '23505' &&
      err.constraint &&
      err.constraint.toLowerCase().includes('username')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error: ' + err.message
    });
  }
});


// ============================================================
// POST /api/staff/bulk-import
// BULK IMPORT STAFF
// ============================================================
router.post('/bulk-import', authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { staff } = req.body;
    const orgId = req.admin.orgId;

    if (
      !staff ||
      !Array.isArray(staff) ||
      staff.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'No staff records provided for import.'
      });
    }

    // --------------------------------------------------------
    // GET BRANCHES
    // --------------------------------------------------------
    const branchesRes = await client.query(
      `
        SELECT
          id,
          name,
          code,
          latitude,
          longitude,
          geofence_radius
        FROM branches
        WHERE org_id = $1
        ${
          req.admin.branchAccess &&
          req.admin.branchAccess !== 'all'
            ? ' AND id = $2'
            : ''
        }
      `,
      req.admin.branchAccess &&
      req.admin.branchAccess !== 'all'
        ? [orgId, req.admin.branchAccess]
        : [orgId]
    );

    const branchesList = branchesRes.rows;

    let importedCount = 0;
    const errors = [];

    const importedStaffIds = new Set();

    await client.query('BEGIN');

    // --------------------------------------------------------
    // PROCESS EACH ROW
    // --------------------------------------------------------
    for (let i = 0; i < staff.length; i++) {

      const row = staff[i];
      const rowNum = i + 1;

      const fName = row.firstName
        ? String(row.firstName).trim()
        : (
            row.fullName
              ? String(row.fullName)
                  .split(' ')[0]
                  .trim()
              : ''
          );

      const lName = row.lastName
        ? String(row.lastName).trim()
        : (
            row.fullName
              ? String(row.fullName)
                  .split(' ')
                  .slice(1)
                  .join(' ')
                  .trim()
              : ''
          );

      const fullName = row.fullName
        ? String(row.fullName).trim()
        : `${fName} ${lName}`.trim();

      const cleanStaffId =
        row.staffId !== undefined &&
        row.staffId !== null
          ? String(row.staffId).trim()
          : '';

      if (!fName && !fullName) {
        errors.push(
          `Row ${rowNum}: Staff name is required.`
        );
        continue;
      }

      if (!cleanStaffId) {
        errors.push(
          `Row ${rowNum} (${fullName}): Staff ID is required.`
        );
        continue;
      }

      const normalizedStaffId =
        cleanStaffId.toLowerCase();

      if (importedStaffIds.has(normalizedStaffId)) {
        errors.push(
          `Row ${rowNum} (${fullName}): Staff ID "${cleanStaffId}" is duplicated in this import file.`
        );
        continue;
      }

      const duplicateStaff = await client.query(
        `
          SELECT id, staff_id
          FROM staff
          WHERE org_id = $1
            AND staff_id IS NOT NULL
            AND TRIM(staff_id) <> ''
            AND LOWER(TRIM(staff_id)) =
                LOWER(TRIM($2))
          LIMIT 1
        `,
        [
          orgId,
          cleanStaffId
        ]
      );

      if (duplicateStaff.rows.length > 0) {
        errors.push(
          `Row ${rowNum} (${fullName}): Staff ID "${cleanStaffId}" already exists.`
        );
        continue;
      }

      importedStaffIds.add(normalizedStaffId);

      // ------------------------------------------------------
      // RESOLVE BRANCH
      // ------------------------------------------------------
      let branchId = null;
      let lat = '0.00000000';
      let lng = '0.00000000';
      let radius = 100;

      if (row.branchId) {
        branchId = parseInt(row.branchId);

        const b = branchesList.find(
          br => br.id === branchId
        );

        if (b) {
          lat = b.latitude || lat;
          lng = b.longitude || lng;
          radius =
            b.geofence_radius || radius;
        }

      } else if (row.branchName) {

        const branchName =
          String(row.branchName)
            .toLowerCase()
            .trim();

        const matchedBranch =
          branchesList.find(b =>
            (
              b.name &&
              b.name.toLowerCase() === branchName
            ) ||
            (
              b.code &&
              b.code.toLowerCase() === branchName
            )
          );

        if (matchedBranch) {
          branchId = matchedBranch.id;

          lat =
            matchedBranch.latitude ||
            lat;

          lng =
            matchedBranch.longitude ||
            lng;

          radius =
            matchedBranch.geofence_radius ||
            radius;
        }
      }

      // ------------------------------------------------------
      // DEFAULT BRANCH
      // ------------------------------------------------------
      if (
        !branchId &&
        branchesList.length > 0
      ) {
        branchId = branchesList[0].id;

        lat =
          branchesList[0].latitude ||
          lat;

        lng =
          branchesList[0].longitude ||
          lng;

        radius =
          branchesList[0].geofence_radius ||
          radius;
      }

      // ------------------------------------------------------
      // PHONE
      // ------------------------------------------------------
      let phone = row.phone
        ? String(row.phone).replace(
            /[^0-9]/g,
            ''
          )
        : null;

      if (
        phone &&
        phone.length > 10 &&
        phone.startsWith('91')
      ) {
        phone = phone.slice(2);
      }

      // ------------------------------------------------------
      // PASSWORD
      // ------------------------------------------------------
      let hashedPassword = null;

      if (
        row.password &&
        String(row.password).trim() !== ''
      ) {
        hashedPassword =
          await bcrypt.hash(
            String(row.password).trim(),
            10
          );
      }

      // ------------------------------------------------------
      // USERNAME
      // ------------------------------------------------------
      let username = row.username
        ? String(row.username).trim()
        : null;

      if (username) {
        const existing =
          await client.query(
            `
              SELECT id
              FROM staff
              WHERE LOWER(TRIM(username)) =
                    LOWER(TRIM($1))
              LIMIT 1
            `,
            [username]
          );

        if (existing.rows.length > 0) {
          username =
            `${username}_${Math.floor(
              100 + Math.random() * 900
            )}`;
        }
      }

      // ------------------------------------------------------
      // DATE OF JOINING
      // ------------------------------------------------------
      let dateOfJoining =
        row.dateOfJoining
          ? String(row.dateOfJoining).trim()
          : null;

      // ------------------------------------------------------
      // INSERT
      // ------------------------------------------------------
      try {

        await client.query(
          `
            INSERT INTO staff (
              org_id,
              branch_id,
              staff_id,
              full_name,
              first_name,
              last_name,
              phone,
              email,
              role_type,
              designation,
              gender,
              date_of_joining,
              username,
              password,
              user_type,
              latitude,
              longitude,
              radius_in_meter,
              is_active
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15, $16,
              $17, $18, true
            )
          `,
          [
            orgId,
            branchId,
            cleanStaffId,
            fullName,
            fName || fullName,
            lName || '',
            phone,
            row.email
              ? String(row.email).trim()
              : null,
            row.roleType || 'teaching',
            row.designation
              ? String(row.designation).trim()
              : null,
            row.gender
              ? String(row.gender).trim()
              : null,
            dateOfJoining,
            username,
            hashedPassword,
            (row.roleType || 'teaching') === 'teaching'
              ? 'Teacher'
              : 'Staff',
            lat,
            lng,
            radius
          ]
        );

        importedCount++;

      } catch (insertErr) {

        if (
          insertErr.code === '23505' &&
          insertErr.constraint &&
          insertErr.constraint.includes(
            'unique_staff_id_per_org'
          )
        ) {
          errors.push(
            `Row ${rowNum} (${fullName}): Staff ID "${cleanStaffId}" already exists.`
          );

          importedStaffIds.delete(
            normalizedStaffId
          );

          continue;
        }

        throw insertErr;
      }
    }

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------
    await client.query('COMMIT');

    if (
      importedCount === 0 &&
      errors.length > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'No staff members were imported. All records were rejected.',
        importedCount: 0,
        errors
      });
    }

    res.json({
      success: true,
      message:
        `Successfully imported ${importedCount} staff member(s).`,
      importedCount,
      errors:
        errors.length > 0
          ? errors
          : []
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(
      'Staff bulk import error:',
      err
    );

    if (
      err.code === '23505' &&
      err.constraint &&
      err.constraint.includes(
        'unique_staff_id_per_org'
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Staff ID already exists. Duplicate Staff ID is not allowed.'
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Failed to import staff: ' +
        err.message
    });

  } finally {
    client.release();
  }
});


// ============================================================
// GET /api/staff/:id
// ============================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {

    const result = await pool.query(
      `
        SELECT
          s.*,
          b.name as branch_name,
          (
            SELECT STRING_AGG(
              COALESCE(c.name, c.class_name) ||
              CASE
                WHEN c.section IS NOT NULL
                  AND c.section != ''
                THEN ' (' || c.section || ')'
                ELSE ''
              END,
              ', ' ORDER BY c.name
            )
            FROM classes c
            WHERE c.teacher_id = s.id
          ) as assigned_classes

        FROM staff s

        LEFT JOIN branches b
          ON b.id = s.branch_id

        WHERE s.id = $1
          AND s.org_id = $2

          ${
            req.admin.branchAccess &&
            req.admin.branchAccess !== 'all'
              ? ' AND s.branch_id = $3'
              : ''
          }
      `,
      req.admin.branchAccess &&
      req.admin.branchAccess !== 'all'
        ? [
            req.params.id,
            req.admin.orgId,
            req.admin.branchAccess
          ]
        : [
            req.params.id,
            req.admin.orgId
          ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found.'
      });
    }

    const s = result.rows[0];

    const rawStaffId =
      s.staff_id &&
      String(s.staff_id).trim() !== ''
        ? String(s.staff_id).trim()
        : String(s.id);

    const displayStaffId =
      rawStaffId.length === 1
        ? rawStaffId.padStart(2, '0')
        : rawStaffId;

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

    res.json({
      success: true,
      staff: formatted
    });

  } catch (err) {

    console.error(
      'Get staff by ID error:',
      err
    );

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
});


// ============================================================
// PUT /api/staff/:id
// EDIT STAFF
// ============================================================
router.put('/:id', authMiddleware, async (req, res) => {
  try {

    const {
      staffId,
      firstName,
      lastName,
      fullName,
      phone,
      email,
      roleType,
      branchId,
      classId,
      designation,
      gender,
      dateOfJoining,
      isActive,
      username,
      password,
      expectedCheckIn,
      expectedCheckOut
    } = req.body;

    const staffMemberId = req.params.id;
    const orgId = req.admin.orgId;

    // --------------------------------------------------------
    // BRANCH ACCESS
    // --------------------------------------------------------
    const scopedBranchId =
      req.admin.branchAccess !== 'all'
        ? Number(req.admin.branchAccess)
        : branchId || null;

    // --------------------------------------------------------
    // CLEAN STAFF ID
    // --------------------------------------------------------
    const cleanStaffId =
      staffId !== undefined &&
      staffId !== null
        ? String(staffId).trim()
        : '';

    // --------------------------------------------------------
    // CHECK DUPLICATE STAFF ID
    // --------------------------------------------------------
    if (cleanStaffId) {

      const duplicateStaff =
        await pool.query(
          `
            SELECT id
            FROM staff
            WHERE org_id = $1
              AND staff_id IS NOT NULL
              AND TRIM(staff_id) <> ''
              AND LOWER(TRIM(staff_id)) =
                  LOWER(TRIM($2))
              AND id <> $3
            LIMIT 1
          `,
          [
            orgId,
            cleanStaffId,
            staffMemberId
          ]
        );

      if (duplicateStaff.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            'Staff ID already exists. Please enter a different Staff ID.'
        });
      }
    }

    // --------------------------------------------------------
    // CHECK DUPLICATE USERNAME
    // --------------------------------------------------------
    if (
      username &&
      username.trim() !== ''
    ) {

      const existingUser =
        await pool.query(
          `
            SELECT id
            FROM staff
            WHERE LOWER(TRIM(username)) =
                  LOWER(TRIM($1))
              AND id != $2
            LIMIT 1
          `,
          [
            username.trim(),
            staffMemberId
          ]
        );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            'Username is already taken by another staff member.'
        });
      }
    }

    // --------------------------------------------------------
    // PASSWORD
    // --------------------------------------------------------
    let hashedPassword = undefined;

    if (
      password &&
      password.trim() !== ''
    ) {
      hashedPassword =
        await bcrypt.hash(
          password,
          10
        );
    }

    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------
    let fName =
      firstName !== undefined
        ? firstName.trim()
        : undefined;

    let lName =
      lastName !== undefined
        ? lastName.trim()
        : undefined;

    let computedFullName =
      undefined;

    if (
      fName !== undefined ||
      lName !== undefined ||
      fullName
    ) {

      const f =
        fName !== undefined
          ? fName
          : (
              fullName
                ? fullName.split(' ')[0]
                : ''
            );

      const l =
        lName !== undefined
          ? lName
          : (
              fullName
                ? fullName
                    .split(' ')
                    .slice(1)
                    .join(' ')
                : ''
            );

      computedFullName =
        `${f} ${l}`.trim() ||
        fullName;

      fName = f;
      lName = l;
    }

    // --------------------------------------------------------
    // BRANCH LOCATION
    // --------------------------------------------------------
    let lat = undefined;
    let lng = undefined;
    let radius = undefined;

    if (scopedBranchId) {

      const bRes =
        await pool.query(
          `
            SELECT
              latitude,
              longitude,
              geofence_radius
            FROM branches
            WHERE id = $1
          `,
          [scopedBranchId]
        );

      if (bRes.rows.length > 0) {

        lat =
          bRes.rows[0].latitude ||
          '0.00000000';

        lng =
          bRes.rows[0].longitude ||
          '0.00000000';

        radius =
          bRes.rows[0].geofence_radius ||
          100;
      }
    }

    // --------------------------------------------------------
    // UPDATE STAFF
    // --------------------------------------------------------
    const result = await pool.query(
      `
        UPDATE staff SET

          staff_id =
            CASE
              WHEN $1::text IS NOT NULL
              THEN $1
              ELSE staff_id
            END,

          full_name =
            COALESCE($2, full_name),

          phone =
            COALESCE($3, phone),

          email =
            COALESCE($4, email),

          role_type =
            COALESCE($5, role_type),

          branch_id =
            COALESCE($6, branch_id),

          designation =
            COALESCE($7, designation),

          gender =
            COALESCE($8, gender),

          date_of_joining =
            COALESCE($9, date_of_joining),

          is_active =
            COALESCE($10, is_active),

          username =
            CASE
              WHEN $11::text IS NOT NULL
              THEN $11
              ELSE username
            END,

          password =
            CASE
              WHEN $12::text IS NOT NULL
              THEN $12
              ELSE password
            END,

          first_name =
            COALESCE($13, first_name),

          last_name =
            COALESCE($14, last_name),

          latitude =
            COALESCE($15, latitude),

          longitude =
            COALESCE($16, longitude),

          radius_in_meter =
            COALESCE($17, radius_in_meter),

          expected_check_in =
            COALESCE($18, expected_check_in),

          expected_check_out =
            COALESCE($19, expected_check_out)

        WHERE id = $20
          AND org_id = $21

          ${
            req.admin.branchAccess &&
            req.admin.branchAccess !== 'all'
              ? ' AND branch_id = $22'
              : ''
          }

        RETURNING *
      `,
      [
        cleanStaffId || null,
        computedFullName || null,
        phone || null,
        email || null,
        roleType || null,
        scopedBranchId || null,
        designation || null,
        gender || null,
        dateOfJoining || null,
        isActive !== undefined
          ? isActive
          : null,
        username !== undefined &&
        username.trim() !== ''
          ? username.trim()
          : null,
        hashedPassword || null,
        fName || null,
        lName || null,
        lat || null,
        lng || null,
        radius || null,
        expectedCheckIn !== undefined ? expectedCheckIn : (req.body.expected_check_in !== undefined ? req.body.expected_check_in : null),
        expectedCheckOut !== undefined ? expectedCheckOut : (req.body.expected_check_out !== undefined ? req.body.expected_check_out : null),
        staffMemberId,
        orgId,

        ...(req.admin.branchAccess &&
        req.admin.branchAccess !== 'all'
          ? [req.admin.branchAccess]
          : [])
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found.'
      });
    }

    // --------------------------------------------------------
    // MANAGE CLASS ASSIGNMENT
    // --------------------------------------------------------
    if (classId !== undefined) {

      await pool.query(
        `
          UPDATE classes
          SET teacher_id = NULL
          WHERE teacher_id = $1
            AND org_id = $2
        `,
        [
          staffMemberId,
          orgId
        ]
      );

      if (classId) {

        await pool.query(
          `
            UPDATE classes
            SET teacher_id = $1
            WHERE id = $2
              AND org_id = $3
          `,
          [
            staffMemberId,
            classId,
            orgId
          ]
        );
      }
    }

    res.json({
      success: true,
      staff: result.rows[0]
    });

  } catch (err) {

    console.error(
      'Staff update error:',
      err
    );

    if (
      err.code === '23505' &&
      err.constraint &&
      err.constraint.includes(
        'unique_staff_id_per_org'
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Staff ID already exists. Please enter a different Staff ID.'
      });
    }

    if (
      err.code === '23505' &&
      err.constraint &&
      err.constraint
        .toLowerCase()
        .includes('username')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Username is already taken.'
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Server error: ' + err.message
    });
  }
});


// ============================================================
// PUT /api/staff/:id/assign-classes
// ============================================================
router.put(
  '/:id/assign-classes',
  authMiddleware,
  async (req, res) => {

    try {

      const { classIds } = req.body;
      const staffId = req.params.id;

      // ------------------------------------------------------
      // UNASSIGN EXISTING CLASSES
      // ------------------------------------------------------
      await pool.query(
        `
          UPDATE classes
          SET teacher_id = NULL
          WHERE teacher_id = $1
            AND org_id = $2
        `,
        [
          staffId,
          req.admin.orgId
        ]
      );

      // ------------------------------------------------------
      // ASSIGN NEW CLASSES
      // ------------------------------------------------------
      if (
        Array.isArray(classIds) &&
        classIds.length > 0
      ) {

        await pool.query(
          `
            UPDATE classes
            SET teacher_id = $1
            WHERE id = ANY($2::int[])
              AND org_id = $3
          `,
          [
            staffId,
            classIds,
            req.admin.orgId
          ]
        );
      }

      res.json({
        success: true,
        message:
          'Classes assigned successfully.'
      });

    } catch (err) {

      console.error(
        'Assign classes error:',
        err
      );

      res.status(500).json({
        success: false,
        message:
          'Server error: ' + err.message
      });
    }
  }
);


// ============================================================
// DELETE /api/staff/:id
// ============================================================
router.delete(
  '/:id',
  authMiddleware,
  requireFullAdmin,
  async (req, res) => {

    try {

      // ------------------------------------------------------
      // UNASSIGN CLASSES
      // ------------------------------------------------------
      await pool.query(
        `
          UPDATE classes
          SET teacher_id = NULL
          WHERE teacher_id = $1
            AND org_id = $2
        `,
        [
          req.params.id,
          req.admin.orgId
        ]
      );

      // ------------------------------------------------------
      // DELETE STAFF
      // ------------------------------------------------------
      await pool.query(
        `
          UPDATE staff
          SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND org_id = $2

            ${
              req.admin.branchAccess &&
              req.admin.branchAccess !== 'all'
                ? ' AND branch_id = $3'
                : ''
            }
        `,
        req.admin.branchAccess &&
        req.admin.branchAccess !== 'all'
          ? [
              req.params.id,
              req.admin.orgId,
              req.admin.branchAccess
            ]
          : [
              req.params.id,
              req.admin.orgId
            ]
      );

      res.json({
        success: true,
        message: 'Staff deleted.'
      });

    } catch (err) {

      console.error(
        'Delete staff error:',
        err
      );

      res.status(500).json({
        success: false,
        message: 'Server error.'
      });
    }
  }
);


module.exports = router;