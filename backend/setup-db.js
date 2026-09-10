const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./src/config/db');

async function setupDatabase() {
  console.log('🔧 Setting up unified database schema (PostgreSQL)...');

  try {
    // 0. Drop existing tables for fresh setup
    console.log('🧹 Cleaning up existing tables...');
    await pool.query(`
      DROP TABLE IF EXISTS
        contact_leaves, leave_masters, leaves, leave_types,
        attendance_logs, app_failure_logs, app_metrics, auth_tokens,
        student_face_images, session_images, attendance_records, attendance_sessions,
        student_attendance_raw_logs, teacher_attendance_raw_logs,
        staff_attendance, student_attendance, students, classes, staff,
        academic_groups, branch_group_members, branch_groups, branches,
        admin_users, organisations, super_admins, holidays, notices CASCADE;
    `);

    // 1. Read and execute schema
    const schema = fs.readFileSync(path.join(__dirname, 'src', 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Schema created successfully!');

    // 2. Read and execute base seed
    const seed = fs.readFileSync(path.join(__dirname, 'src', 'db', 'seed.sql'), 'utf8');
    await pool.query(seed);
    console.log('✅ Base seed data inserted successfully!');

    // 3. Update SuperAdmin and OrgAdmin password hashes
    const superAdminHash = await bcrypt.hash('SuperAdmin@123', 10);
    await pool.query('UPDATE super_admins SET password_hash = $1 WHERE username = $2', [superAdminHash, 'superadmin']);

    const venkatHash = await bcrypt.hash('Venkat@312', 10);
    await pool.query('UPDATE admin_users SET password_hash = $1 WHERE username = $2', [venkatHash, 'venkat']);

    // 4. Ensure mobile app default teacher exists in unified staff table
    const plainPassword = 'teacher123';
    const teacherHash = await bcrypt.hash(plainPassword, 10);

    const orgRes = await pool.query("SELECT id FROM organisations WHERE code = 'vts' LIMIT 1");
    const orgId = orgRes.rows[0] ? orgRes.rows[0].id : 1;

    const teacherRes = await pool.query(
      `INSERT INTO staff 
      (org_id, username, password, full_name, email, phone, role_type, customer_id, customer_name, first_name, last_name, user_type, biometric_id, latitude, longitude, radius_in_meter) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password
      RETURNING id`,
      [
        orgId, 'teacher', teacherHash, 'John Smith', 'john.smith@school.com', '+15550199',
        'teaching', 1, 'Main School District', 'John', 'Smith', 'Teacher', 'BIOMETRIC_1',
        12.9715987, 77.5945627, 500
      ]
    );
    const teacherId = teacherRes.rows[0].id;

    // Seed classes linked to teacherId
    const classRes = await pool.query(
      `INSERT INTO classes (org_id, teacher_id, name, class_name, grade, section, subject, student_count, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [orgId, teacherId, 'Class 10A', 'Class 10A', '10', 'A', 'Mathematics', 5, '2026-2027']
    );
    const classId = classRes.rows[0].id;

    // Seed mobile students
    await pool.query(
      `INSERT INTO students (org_id, class_id, full_name, roll_no, roll_number, email) VALUES 
      ($1, $2, 'Sanjay Kumar', '101', '101', 'sanjay@school.com'),
      ($1, $2, 'Priya Sharma', '102', '102', 'priya@school.com'),
      ($1, $2, 'Amit Patel', '103', '103', 'amit@school.com')
      ON CONFLICT DO NOTHING`,
      [orgId, classId]
    );

    // Seed leave masters for mobile app
    await pool.query(`INSERT INTO leave_masters 
      (lcode, lshort_name, ldescription, is_off_include, is_holiday_include, treated_as_present, leave_limit) VALUES 
      (1, 'CL', 'Casual Leave', false, false, false, 12),
      (2, 'SL', 'Sick Leave', true, true, false, 10),
      (3, 'PL', 'Privilege Leave', false, false, false, 15)
      ON CONFLICT (lcode) DO NOTHING`);

    console.log('\n🎉 Central Database Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 Super Admin Login:');
    console.log('   URL:      http://localhost:5173/super-admin/login');
    console.log('   Username: superadmin');
    console.log('   Password: SuperAdmin@123');
    console.log('');
    console.log('🏫 Organisation Admin Login:');
    console.log('   URL:       http://localhost:5173/login');
    console.log('   Org Code:  vts');
    console.log('   Username:  venkat');
    console.log('   Password:  Venkat@312');
    console.log('');
    console.log('📱 Mobile / Device Teacher Login:');
    console.log('   Endpoint: POST /api/login or /api/Device/ValidateUser');
    console.log('   Username: teacher');
    console.log('   Password: teacher123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
