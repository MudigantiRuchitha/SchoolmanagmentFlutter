require('dotenv').config();
const pool = require('../src/config/db');

async function migrate() {
  try {
    console.log('Running academic data schema migrations...');
    await pool.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS department VARCHAR(100)');
    await pool.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS subject VARCHAR(100)');
    await pool.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50) DEFAULT \'2026-2027\'');
    await pool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT \'2026-2027\'');
    await pool.query('UPDATE classes SET academic_year = \'2026-2027\' WHERE academic_year IS NULL');
    await pool.query('UPDATE staff SET academic_year = \'2026-2027\' WHERE academic_year IS NULL');

    await pool.query(`
      UPDATE staff SET 
        department = CASE 
          WHEN LOWER(COALESCE(designation, '')) LIKE '%math%' THEN 'Mathematics'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%science%' THEN 'Science'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%english%' THEN 'Languages'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%hindi%' THEN 'Languages'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%computer%' THEN 'Information Technology'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%social%' THEN 'Social Sciences'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%lab%' THEN 'Laboratory Services'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%office%' THEN 'Administration'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%account%' THEN 'Finance & Accounts'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%principal%' THEN 'Administration'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%manager%' THEN 'Administration'
          WHEN role_type = 'teaching' THEN 'Academics'
          ELSE 'Administration'
        END,
        subject = CASE
          WHEN LOWER(COALESCE(designation, '')) LIKE '%math%' THEN 'Mathematics'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%science%' THEN 'Science'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%english%' THEN 'English'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%hindi%' THEN 'Hindi'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%computer%' THEN 'Computer Science'
          WHEN LOWER(COALESCE(designation, '')) LIKE '%social%' THEN 'Social Studies'
          WHEN role_type = 'teaching' THEN 'General'
          ELSE NULL
        END
      WHERE department IS NULL OR subject IS NULL
    `);

    // Assign sample classes to teachers where empty
    await pool.query(`UPDATE classes SET teacher_id = 1 WHERE id = 1 AND teacher_id IS NULL`);
    await pool.query(`UPDATE classes SET teacher_id = 2 WHERE id = 2 AND teacher_id IS NULL`);
    await pool.query(`UPDATE classes SET teacher_id = 9 WHERE id = 7 AND teacher_id = 6`);
    await pool.query(`UPDATE classes SET teacher_id = 10 WHERE id = 6 AND teacher_id = 6`);

    console.log('✅ Academic data migration complete!');
    const s = await pool.query('SELECT id, full_name, role_type, designation, department, subject, academic_year FROM staff LIMIT 10');
    console.table(s.rows);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
