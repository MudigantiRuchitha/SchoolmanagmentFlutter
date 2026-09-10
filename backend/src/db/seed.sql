-- ============================================================
-- School Management System - Seed Data
-- ============================================================
-- Passwords are bcrypt hashed (cost factor 10)
-- SuperAdmin: superadmin / SuperAdmin@123
-- VTS Admin: venkat / Venkat@312
-- ============================================================

-- Super Admin (password: SuperAdmin@123)
INSERT INTO super_admins (username, password_hash, full_name, email) VALUES
('superadmin', '$2a$10$rOvHjSNLUOhSfm0DEQl3o.5BFUiW1BOy.7eQ2g3pZ7u.pDNz3vOLy', 'Super Administrator', 'superadmin@schoolmgmt.com')
ON CONFLICT (username) DO NOTHING;

-- Organisation: VTS (Venkat Training School)
INSERT INTO organisations (name, code, domain, address, phone, email, is_active) VALUES
('Venkat Training School', 'vts', 'vts.schoolmgmt.com', '123 Main Street, Hyderabad, Telangana 500001', '+91-9876543210', 'admin@vts.edu.in', true)
ON CONFLICT (code) DO NOTHING;

-- VTS Admin (password: Venkat@312)
INSERT INTO admin_users (org_id, username, password_hash, full_name, email, role, branch_access, is_active)
SELECT o.id, 'venkat', '$2a$10$3J8oAHIcNkj.kVJNOGRdyeGijmVcyWo1HB1KuTy3FqNxl79MzVoaS', 'Venkat Kumar', 'venkat@vts.edu.in', 'admin', 'all', true
FROM organisations o WHERE o.code = 'vts'
ON CONFLICT (org_id, username) DO NOTHING;

-- VTS Branches
INSERT INTO branches (org_id, name, code, contact_person, phone, address, is_active)
SELECT o.id, 'Main Campus', 'MAIN', 'Venkat Kumar', '+91-9876543210', '123 Main Street, Hyderabad', true
FROM organisations o WHERE o.code = 'vts'
ON CONFLICT DO NOTHING;

INSERT INTO branches (org_id, name, code, contact_person, phone, address, is_active)
SELECT o.id, 'North Branch', 'NORTH', 'Ravi Sharma', '+91-9876543211', '45 North Avenue, Secunderabad', true
FROM organisations o WHERE o.code = 'vts'
ON CONFLICT DO NOTHING;

INSERT INTO branches (org_id, name, code, contact_person, phone, address, is_active)
SELECT o.id, 'South Branch', 'SOUTH', 'Priya Reddy', '+91-9876543212', '78 South Road, Hyderabad', true
FROM organisations o WHERE o.code = 'vts'
ON CONFLICT DO NOTHING;

-- VTS Academic Groups
INSERT INTO academic_groups (org_id, name, description)
SELECT o.id, 'Primary', 'Classes 1 to 5'
FROM organisations o WHERE o.code = 'vts';

INSERT INTO academic_groups (org_id, name, description)
SELECT o.id, 'Secondary', 'Classes 6 to 10'
FROM organisations o WHERE o.code = 'vts';

INSERT INTO academic_groups (org_id, name, description)
SELECT o.id, 'Higher Secondary', 'Classes 11 to 12'
FROM organisations o WHERE o.code = 'vts';

-- VTS Classes (using Main branch)
INSERT INTO classes (org_id, academic_group_id, branch_id, name, section)
SELECT o.id, ag.id, b.id, 'Class 1', 'A'
FROM organisations o
JOIN academic_groups ag ON ag.org_id = o.id AND ag.name = 'Primary'
JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN'
WHERE o.code = 'vts';

INSERT INTO classes (org_id, academic_group_id, branch_id, name, section)
SELECT o.id, ag.id, b.id, 'Class 2', 'A'
FROM organisations o
JOIN academic_groups ag ON ag.org_id = o.id AND ag.name = 'Primary'
JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN'
WHERE o.code = 'vts';

INSERT INTO classes (org_id, academic_group_id, branch_id, name, section)
SELECT o.id, ag.id, b.id, 'Class 6', 'A'
FROM organisations o
JOIN academic_groups ag ON ag.org_id = o.id AND ag.name = 'Secondary'
JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN'
WHERE o.code = 'vts';

-- VTS Staff
INSERT INTO staff (org_id, branch_id, staff_id, full_name, phone, email, role_type, designation, gender, is_active)
SELECT o.id, b.id, 'STF001', 'Ananya Iyer', '+91-9876543220', 'ananya@vts.edu.in', 'teaching', 'Senior Teacher', 'Female', true
FROM organisations o JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN' WHERE o.code = 'vts';

INSERT INTO staff (org_id, branch_id, staff_id, full_name, phone, email, role_type, designation, gender, is_active)
SELECT o.id, b.id, 'STF002', 'Kiran Babu', '+91-9876543221', 'kiran@vts.edu.in', 'teaching', 'Teacher', 'Male', true
FROM organisations o JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN' WHERE o.code = 'vts';

INSERT INTO staff (org_id, branch_id, staff_id, full_name, phone, email, role_type, designation, gender, is_active)
SELECT o.id, b.id, 'STF003', 'Meena Kumari', '+91-9876543222', 'meena@vts.edu.in', 'non-teaching', 'Office Staff', 'Female', true
FROM organisations o JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN' WHERE o.code = 'vts';

INSERT INTO staff (org_id, branch_id, staff_id, full_name, phone, email, role_type, designation, gender, is_active)
SELECT o.id, b.id, 'STF004', 'Suresh Rao', '+91-9876543223', 'suresh@vts.edu.in', 'management', 'Manager', 'Male', true
FROM organisations o JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN' WHERE o.code = 'vts';

-- VTS Students
INSERT INTO students (org_id, class_id, branch_id, admission_no, roll_no, full_name, phone, parent_name, parent_phone, gender, is_active)
SELECT o.id, c.id, b.id, 'ADM2024001', 'R001', 'Aarav Singh', '+91-9876543230', 'Ramesh Singh', '+91-9876543230', 'Male', true
FROM organisations o
JOIN classes c ON c.org_id = o.id AND c.name = 'Class 1'
JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN'
WHERE o.code = 'vts';

INSERT INTO students (org_id, class_id, branch_id, admission_no, roll_no, full_name, phone, parent_name, parent_phone, gender, is_active)
SELECT o.id, c.id, b.id, 'ADM2024002', 'R002', 'Diya Patel', '+91-9876543231', 'Amit Patel', '+91-9876543231', 'Female', true
FROM organisations o
JOIN classes c ON c.org_id = o.id AND c.name = 'Class 1'
JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN'
WHERE o.code = 'vts';

INSERT INTO students (org_id, class_id, branch_id, admission_no, roll_no, full_name, phone, parent_name, parent_phone, gender, is_active)
SELECT o.id, c.id, b.id, 'ADM2024003', 'R001', 'Arjun Reddy', '+91-9876543232', 'Ravi Reddy', '+91-9876543232', 'Male', true
FROM organisations o
JOIN classes c ON c.org_id = o.id AND c.name = 'Class 6'
JOIN branches b ON b.org_id = o.id AND b.code = 'MAIN'
WHERE o.code = 'vts';

-- VTS Leave Types
INSERT INTO leave_types (org_id, name, max_days)
SELECT o.id, 'Casual Leave', 12 FROM organisations o WHERE o.code = 'vts';

INSERT INTO leave_types (org_id, name, max_days)
SELECT o.id, 'Medical Leave', 15 FROM organisations o WHERE o.code = 'vts';

INSERT INTO leave_types (org_id, name, max_days)
SELECT o.id, 'Earned Leave', 20 FROM organisations o WHERE o.code = 'vts';

INSERT INTO leave_types (org_id, name, max_days)
SELECT o.id, 'Maternity Leave', 90 FROM organisations o WHERE o.code = 'vts';

-- VTS Holidays
INSERT INTO holidays (org_id, name, date, type, description)
SELECT o.id, 'Independence Day', '2024-08-15', 'national', 'National Holiday - Independence Day'
FROM organisations o WHERE o.code = 'vts';

INSERT INTO holidays (org_id, name, date, type, description)
SELECT o.id, 'Gandhi Jayanti', '2024-10-02', 'national', 'National Holiday - Gandhi Jayanti'
FROM organisations o WHERE o.code = 'vts';

INSERT INTO holidays (org_id, name, date, type, description)
SELECT o.id, 'Diwali', '2024-11-01', 'regional', 'Festival Holiday - Diwali'
FROM organisations o WHERE o.code = 'vts';

INSERT INTO holidays (org_id, name, date, type, description)
SELECT o.id, 'School Annual Day', '2024-12-15', 'org', 'School Annual Function'
FROM organisations o WHERE o.code = 'vts';

-- VTS Sample Notice
INSERT INTO notices (org_id, title, audience, content, created_by)
SELECT o.id, 'Welcome to VTS Management System', 'all',
  'Welcome to the Venkat Training School management system. This platform helps manage student and staff attendance, leaves, and more. Please explore all features available.',
  au.id
FROM organisations o
JOIN admin_users au ON au.org_id = o.id AND au.username = 'venkat'
WHERE o.code = 'vts';

-- Sample Attendance for today
INSERT INTO student_attendance (student_id, org_id, date, check_in, check_out, status, mode)
SELECT s.id, s.org_id, CURRENT_DATE, '08:30:00', '15:30:00', 'present', 'manual'
FROM students s
JOIN organisations o ON o.id = s.org_id
WHERE o.code = 'vts'
ON CONFLICT (student_id, date) DO NOTHING;

INSERT INTO staff_attendance (staff_id, org_id, date, check_in, check_out, shift_status, mode)
SELECT s.id, s.org_id, CURRENT_DATE, '09:00:00', '17:00:00', 'present', 'manual'
FROM staff s
JOIN organisations o ON o.id = s.org_id
WHERE o.code = 'vts'
ON CONFLICT (staff_id, date) DO NOTHING;
