const { Pool } = require('pg');
require('dotenv').config();

const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'schoolmanagement',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
});

pgPool.on('connect', () => {
  // Connected to PostgreSQL database
});

pgPool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Auto-migration: Ensure teacher_ids INT[] column exists on classes table
pgPool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS teacher_ids INT[]').catch(err => {
  console.error('Failed to add teacher_ids column to classes:', err.message);
});

// Auto-migration: Academic data columns on staff and classes
pgPool.query(`
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS department VARCHAR(100);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50) DEFAULT '2026-2027';
  ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026-2027';
`).catch(err => {
  console.error('Failed to add academic data columns:', err.message);
});

pgPool.query(`
  CREATE TABLE IF NOT EXISTS student_attendance_raw_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    token_id VARCHAR(500),
    user_id VARCHAR(100),
    user_type VARCHAR(50),
    db_operation VARCHAR(20),
    capture_mode VARCHAR(100),
    device_id VARCHAR(200),
    machine_id VARCHAR(100),
    period VARCHAR(50),
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    admission_no VARCHAR(100),
    punch_time TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    raw_payload JSONB NOT NULL,
    raw_punch JSONB NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE student_attendance_raw_logs
    ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;
  CREATE TABLE IF NOT EXISTS teacher_attendance_raw_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    token_id VARCHAR(500),
    user_id VARCHAR(100),
    user_type VARCHAR(50),
    contact_id VARCHAR(100),
    biometric_id VARCHAR(100),
    source VARCHAR(100),
    device_id VARCHAR(200),
    punch_time TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    raw_payload JSONB NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => {
  console.error('Failed to create raw attendance log tables:', err.message);
});

pgPool.query(`
  CREATE TABLE IF NOT EXISTS staff_attendance_punches (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    punch_time TIME NOT NULL,
    mode VARCHAR(20) DEFAULT 'device',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_staff_attendance_punches_lookup
    ON staff_attendance_punches(staff_id, date, punch_time);
`).catch(err => {
  console.error('Failed to create staff attendance punch table:', err.message);
});

async function query(text, params) {
  const res = await pgPool.query(text, params);
  const resultObj = {
    insertId: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null,
    affectedRows: res.rowCount
  };
  const arr = [res.rows, resultObj];
  arr.rows = res.rows;
  arr.rowCount = res.rowCount;
  return arr;
}

const dbInterface = {
  query,
  pool: pgPool,
  connect: () => pgPool.connect(),
  end: () => pgPool.end(),
  on: (...args) => pgPool.on(...args),
  getConnection: async () => {
    const client = await pgPool.connect();
    return {
      query: async (text, params) => {
        const res = await client.query(text, params);
        const resultObj = {
          insertId: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null,
          affectedRows: res.rowCount
        };
        const arr = [res.rows, resultObj];
        arr.rows = res.rows;
        arr.rowCount = res.rowCount;
        return arr;
      },
      beginTransaction: async () => client.query('BEGIN'),
      commit: async () => client.query('COMMIT'),
      rollback: async () => client.query('ROLLBACK'),
      release: () => client.release()
    };
  }
};

module.exports = dbInterface;
pgPool.query(`
  SELECT id, org_id, staff_id, full_name, username, branch_id
  FROM public.staff
  ORDER BY id
`)
.then(result => {
  console.log("========== STAFF DATA FROM BACKEND ==========");
  console.table(result.rows);
  console.log("TOTAL STAFF:", result.rows.length);
  console.log("==============================================");
})
.catch(err => {
  console.error("STAFF CHECK ERROR:", err.message);
});
// TEMPORARY DATABASE CHECK
pgPool.query(`
  SELECT
    current_database() AS database_name,
    current_schema() AS schema_name,
    current_user AS database_user,
    inet_server_addr() AS server_address,
    inet_server_port() AS server_port
`)
.then(result => {
  console.log('');
  console.log('==========================================');
  console.log('🔎 BACKEND DATABASE CONNECTION');
  console.log('==========================================');
  console.log(result.rows[0]);
  console.log('==========================================');
})
.catch(err => {
  console.error('❌ DATABASE CHECK FAILED:', err.message);
});

