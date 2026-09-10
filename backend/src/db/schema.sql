-- ============================================================
-- Unified School Management & Attendance System - PostgreSQL Schema
-- ============================================================

-- Super Admins (Platform Level - manages all organisations)
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200),
  email VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Organisations (Multi-tenant root)
CREATE TABLE IF NOT EXISTS organisations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  domain VARCHAR(200),      
  logo_url VARCHAR(500),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin Users (Org-level admins)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'admin',
  branch_access TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, username)
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50),
  contact_person VARCHAR(200),
  phone VARCHAR(20),
  email VARCHAR(200),
  address TEXT,
  latitude VARCHAR(50),
  longitude VARCHAR(50),
  geofence_radius INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Branch Groups
CREATE TABLE IF NOT EXISTS branch_groups (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Branch Group Members
CREATE TABLE IF NOT EXISTS branch_group_members (
  group_id INTEGER REFERENCES branch_groups(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, branch_id)
);

-- Academic Groups (e.g. Primary, Secondary, Higher Secondary)
CREATE TABLE IF NOT EXISTS academic_groups (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Unified Staff Table (Handles Teaching and Non-Teaching Staff, Web and Mobile App credentials)
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  staff_id VARCHAR(100),
  username VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  full_name VARCHAR(200) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(200),
  phone VARCHAR(20),
  role_type VARCHAR(50) DEFAULT 'teaching', -- 'teaching' or 'non_teaching'
  designation VARCHAR(100),
  gender VARCHAR(10),
  photo_url VARCHAR(500),
  profile_image VARCHAR(500),
  customer_id INTEGER DEFAULT 1,
  customer_name VARCHAR(100) DEFAULT 'Default School District',
  user_type VARCHAR(50) DEFAULT 'Teacher',
  contact_id INTEGER DEFAULT 1,
  latitude DECIMAL(10, 8) DEFAULT 0.00000000,
  longitude DECIMAL(11, 8) DEFAULT 0.00000000,
  allow_app_attendance VARCHAR(10) DEFAULT 'Yes',
  allow_manual_attendance VARCHAR(10) DEFAULT 'Yes',
  radius_in_meter INTEGER DEFAULT 100,
  biometric_id VARCHAR(50) DEFAULT 'BIOMETRIC_1',
  date_of_joining DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes / Sections
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  academic_group_id INTEGER REFERENCES academic_groups(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  name VARCHAR(200),
  class_name VARCHAR(100),
  grade VARCHAR(20),
  section VARCHAR(50),
  subject VARCHAR(50),
  student_count INTEGER DEFAULT 0,
  academic_year VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  admission_no VARCHAR(100),
  roll_no VARCHAR(50),
  roll_number VARCHAR(50),
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  parent_name VARCHAR(200),
  parent_contact VARCHAR(20),
  parent_phone VARCHAR(20),
  email VARCHAR(100),
  gender VARCHAR(10),
  date_of_birth DATE,
  photo_url VARCHAR(500),
  has_face_data BOOLEAN DEFAULT FALSE,
  face_embedding TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Attendance (Web Portal)
CREATE TABLE IF NOT EXISTS student_attendance (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status VARCHAR(20) DEFAULT 'present',
  mode VARCHAR(20) DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- Staff Attendance (Web Portal)
CREATE TABLE IF NOT EXISTS staff_attendance (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  shift_status VARCHAR(20) DEFAULT 'present',
  mode VARCHAR(20) DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

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

-- Raw mobile attendance submissions (kept for audit and replay)
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

-- Attendance Sessions (Mobile App / Device)
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_time TIME,
    total_students INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_address TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Records (Mobile App / Device)
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    confidence_score FLOAT,
    recognition_method VARCHAR(20) DEFAULT 'manual',
    remarks TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (session_id, student_id)
);

-- Session Images
CREATE TABLE IF NOT EXISTS session_images (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    image_path VARCHAR(255) NOT NULL,
    image_url TEXT,
    upload_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Face Images
CREATE TABLE IF NOT EXISTS student_face_images (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    image_path VARCHAR(255),
    image_url TEXT,
    face_embedding TEXT,
    quality_score FLOAT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auth Tokens (Mobile App / Device)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App Metrics
CREATE TABLE IF NOT EXISTS app_metrics (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100),
    login_time_ms INTEGER DEFAULT 0,
    student_sync_time_ms INTEGER DEFAULT 0,
    server_capture_time_ms INTEGER DEFAULT 0,
    submit_time_ms INTEGER DEFAULT 0,
    login_status VARCHAR(20) DEFAULT 'pending',
    sync_status VARCHAR(20) DEFAULT 'pending',
    capture_status VARCHAR(20) DEFAULT 'pending',
    capture_reason TEXT,
    submit_status VARCHAR(20) DEFAULT 'pending',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App Failure Logs
CREATE TABLE IF NOT EXISTS app_failure_logs (
    id SERIAL PRIMARY KEY,
    log_id VARCHAR(50) UNIQUE,
    device_id VARCHAR(100),
    event_name VARCHAR(100),
    reason TEXT,
    stack_trace TEXT,
    operation_context VARCHAR(100),
    severity VARCHAR(20) DEFAULT 'error',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual Attendance Logs
CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    person_id INTEGER,
    enroll_id INTEGER,
    face_id INTEGER,
    name VARCHAR(100),
    timestamp BIGINT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    method VARCHAR(50) DEFAULT 'face',
    image_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave Types (Web Portal)
CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  max_days INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaves (Web Portal)
CREATE TABLE IF NOT EXISTS leaves (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  leave_type_id INTEGER REFERENCES leave_types(id) ON DELETE SET NULL,
  leave_type_name VARCHAR(100),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  total_days INTEGER DEFAULT 1,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  applied_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  review_comment TEXT
);

-- Leave Masters (Mobile App / Device)
CREATE TABLE IF NOT EXISTS leave_masters (
    lcode INTEGER PRIMARY KEY,
    cust_id INTEGER DEFAULT 1,
    lshort_name VARCHAR(20) NOT NULL,
    ldescription VARCHAR(255) NOT NULL,
    is_off_include BOOLEAN DEFAULT FALSE,
    is_holiday_include BOOLEAN DEFAULT FALSE,
    treated_as_present BOOLEAN DEFAULT FALSE,
    leave_limit INTEGER DEFAULT 0,
    is_auto_accrual_allowed BOOLEAN DEFAULT FALSE,
    is_carried_forward BOOLEAN DEFAULT FALSE,
    max_continuous_leave INTEGER DEFAULT 0
);

-- Contact Leaves (Mobile App / Device)
CREATE TABLE IF NOT EXISTS contact_leaves (
    id SERIAL PRIMARY KEY,
    lcode INTEGER NOT NULL REFERENCES leave_masters(lcode) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL,
    application_date DATE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_amount FLOAT DEFAULT 1.0,
    leave_amt_type INTEGER DEFAULT 0,
    leave_reason TEXT,
    status INTEGER DEFAULT 0,
    leave_status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Holidays (Combined Web Portal & Mobile App)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
    cust_id INTEGER DEFAULT 1,
    name VARCHAR(200),
    date DATE,
    holiday_date DATE,
    holiday_to_date DATE,
    holiday_desc TEXT,
    type VARCHAR(50) DEFAULT 'national',
    description TEXT,
    is_range INTEGER DEFAULT 0,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notices (Web Portal)
CREATE TABLE IF NOT EXISTS notices (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  audience VARCHAR(50) DEFAULT 'all',
  content TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON student_attendance(org_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(org_id, date);
CREATE INDEX IF NOT EXISTS idx_students_org ON students(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_org ON staff(org_id);
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(org_id);
CREATE INDEX IF NOT EXISTS idx_leaves_org ON leaves(org_id);
CREATE INDEX IF NOT EXISTS idx_notices_org ON notices(org_id);
