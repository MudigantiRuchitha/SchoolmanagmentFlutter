const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const orgs = require('../config/orgs');

// Standard Teacher Login
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM staff WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)) AND is_active = true', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const teacher = rows[0];
    const isPasswordValid = await comparePassword(password, teacher.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = generateToken({ id: teacher.id, username: teacher.username });
    await db.query(
      `INSERT INTO auth_tokens (teacher_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')
       ON CONFLICT (token) DO UPDATE SET expires_at = NOW() + INTERVAL '1 day'`,
      [teacher.id, token]
    );
    const displayStaffId = (teacher.staff_id && String(teacher.staff_id).trim() !== '') ? teacher.staff_id : teacher.id;
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        teacherId: teacher.id,
        staffId: displayStaffId,
        dbId: teacher.id,
        fullName: teacher.full_name,
        email: teacher.email,
        token: token
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

function buildStaffPayload(t) {
  const rawStaffId = (t.staff_id && String(t.staff_id).trim() !== '') ? String(t.staff_id).trim() : String(t.id);
  const displayStaffId = rawStaffId.length === 1 ? rawStaffId.padStart(2, '0') : rawStaffId;
  const dbPkId = t.id;

  return {
    // Primary User / Contact & Staff Identifiers for UI Display (e.g., "01", "02")
    id: displayStaffId,
    Id: displayStaffId,
    ID: displayStaffId,
    UserId: displayStaffId,
    userId: displayStaffId,
    USERID: displayStaffId,
    UserID: displayStaffId,
    ContactId: displayStaffId,
    contactId: displayStaffId,
    CONTACTID: displayStaffId,
    ContactID: displayStaffId,
    CID: displayStaffId,
    CId: displayStaffId,
    cid: displayStaffId,
    StaffId: displayStaffId,
    staffId: displayStaffId,
    staff_id: displayStaffId,
    StaffID: displayStaffId,
    STAFFID: displayStaffId,
    BiometricId: displayStaffId,
    biometricId: displayStaffId,
    BIOMETRICID: displayStaffId,
    EmployeeId: displayStaffId,
    employeeId: displayStaffId,
    employee_id: displayStaffId,
    EmployeeID: displayStaffId,
    EMPLOYEEID: displayStaffId,
    EmpId: displayStaffId,
    empId: displayStaffId,
    emp_id: displayStaffId,
    EmpID: displayStaffId,
    EMPID: displayStaffId,
    EmployeeNo: displayStaffId,
    employeeNo: displayStaffId,
    employee_no: displayStaffId,
    EmployeeNO: displayStaffId,
    EMPLOYEENO: displayStaffId,
    employee_number: displayStaffId,
    employeeNumber: displayStaffId,
    EmployeeNumber: displayStaffId,
    emp_no: displayStaffId,
    empNo: displayStaffId,
    EmpNo: displayStaffId,
    EmpNO: displayStaffId,
    EMPNO: displayStaffId,
    StaffNo: displayStaffId,
    staffNo: displayStaffId,
    staff_no: displayStaffId,
    STAFFNO: displayStaffId,
    StaffCode: displayStaffId,
    staffCode: displayStaffId,
    staff_code: displayStaffId,
    STAFFCODE: displayStaffId,
    EmpCode: displayStaffId,
    empCode: displayStaffId,
    emp_code: displayStaffId,
    EMPCODE: displayStaffId,
    EmployeeCode: displayStaffId,
    employeeCode: displayStaffId,
    employee_code: displayStaffId,
    EMPLOYEECODE: displayStaffId,
    UserCode: displayStaffId,
    userCode: displayStaffId,
    user_code: displayStaffId,
    USERCODE: displayStaffId,
    Code: displayStaffId,
    code: displayStaffId,
    CODE: displayStaffId,
    DisplayStaffId: displayStaffId,
    displayStaffId: displayStaffId,
    DisplayEmpId: displayStaffId,
    displayEmpId: displayStaffId,

    // Database Internal Primary Keys (Integer DB PK for FKs)
    DbId: dbPkId,
    dbId: dbPkId,
    db_id: dbPkId,
    teacher_id: dbPkId,
    teacherId: dbPkId,
    TeacherId: dbPkId,

    // User Names & Demographics
    username: t.username,
    UserName: t.username,
    full_name: t.full_name,
    fullName: t.full_name,
    FullName: t.full_name,
    name: t.full_name,
    Name: t.full_name,
    CName: t.full_name,
    first_name: t.first_name || t.full_name,
    firstName: t.first_name || t.full_name,
    FirstName: t.first_name || t.full_name,
    PName: t.first_name || t.full_name,
    last_name: t.last_name || '',
    lastName: t.last_name || '',
    LastName: t.last_name || '',
    email: t.email || '',
    phone: t.phone || '',
    PhoneNo1: t.phone || '',
    role_type: t.role_type,
    user_type: t.user_type || 'Teacher',
    UserType: t.user_type || 'Teacher',
    Designation: t.user_type || 'Teacher',
    designation: t.designation || t.user_type || 'Teacher',
    Gender: t.gender || 'Male',
    gender: t.gender || 'Male',
    ProfileImage: t.profile_image || '',
    PhotoPath: t.profile_image || '',
    PhotoUriPath: t.profile_image || '',
    ParentName: t.first_name || t.full_name || 'Deepak',
    CustomerId: t.customer_id || t.org_id || 1,
    CustomerName: t.customer_name || 'School District',
    Latitude: t.latitude ? t.latitude.toString() : '0.00000000',
    Longitude: t.longitude ? t.longitude.toString() : '0.00000000',
    AllowAppAttendance: t.allow_app_attendance || 'Yes',
    AllowManualAttendance: t.allow_manual_attendance || 'Yes',
    RadiusInMeter: t.radius_in_meter || 100
  };
}

// Device Validate User & Login
async function deviceLogin(req, res) {
  const { Username, Password } = req.body;

  console.log('deviceLogin request - URL:', req.originalUrl, 'body:', req.body);

  if (Username && Password && Username.toLowerCase() === 'org_check' && Password.toLowerCase() === 'org_check') {
    console.log('org_check bypass accepted');
    return res.json({ Status: 1, Message: 'Organization verification successful' });
  }

  const orgCode = req.orgCode || (function () {
    const match = req.originalUrl.match(/attendance\/([^/]+)\/api/);
    return match ? match[1] : null;
  })();

  console.log('Extracted orgCode:', orgCode);

  if (orgCode && !orgs.isValid(orgCode)) {
    console.log('Invalid org code detected:', orgCode);
    return res.json({ Status: 0, Message: 'Invalid organization code' });
  }

  if (!Username || !Password) {
    return res.json({ Status: 0, Message: 'Username and password are required' });
  }

  try {
    const padded1 = String(Username).padStart(2, '0');
    const [rows] = await db.query(
      `SELECT * FROM staff 
       WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR staff_id = $1 OR staff_id = $2 OR id::text = $1) 
         AND is_active = true
       ORDER BY CASE 
         WHEN LOWER(username) = LOWER($1) THEN 1 
         WHEN staff_id = $1 THEN 2 
         WHEN staff_id = $2 THEN 3 
         ELSE 4 
       END`,
      [String(Username), padded1]
    );
    if (rows.length === 0) {
      return res.json({ Status: 0, Message: 'Invalid username or password' });
    }
    const teacher = rows[0];
    const isPasswordValid = await comparePassword(Password, teacher.password);
    if (!isPasswordValid) {
      return res.json({ Status: 0, Message: 'Invalid username or password' });
    }
    const token = generateToken({ id: teacher.id, username: teacher.username });
    await db.query(
      `INSERT INTO auth_tokens (teacher_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')
       ON CONFLICT (token) DO UPDATE SET expires_at = NOW() + INTERVAL '1 day'`,
      [teacher.id, token]
    );

    const payload = buildStaffPayload(teacher);

    res.json({
      Status: 1,
      Message: 'User validated successfully',
      Token: token,
      objDeviceUserInfo: payload,
      objContactInfo: payload,
      data: payload
    });
  } catch (err) {
    console.error('deviceLogin error:', err);
    res.json({ Status: 0, Message: 'Server error: ' + err.message });
  }
}

// Admin Auth Login
async function adminLogin(req, res) {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({
      success: true,
      message: 'Admin login successful',
      token: 'mock_admin_token'
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
}

// Change Password
async function changePassword(req, res) {
  const { objResetPasswordInfo, UserId } = req.body;
  if (!objResetPasswordInfo || !objResetPasswordInfo.NewPassword) {
    return res.json({ Status: 0, Message: 'NewPassword is required' });
  }
  try {
    const hashed = await hashPassword(objResetPasswordInfo.NewPassword);
    await db.query('UPDATE staff SET password = $1 WHERE id::text = $2::text OR staff_id = $2::text', [hashed, UserId]);
    res.json({ Status: 1, Message: 'Password changed successfully', Exception: null });
  } catch (err) {
    res.json({ Status: 0, Message: 'Password change failed', Exception: err.message });
  }
}

function extractUserId(req) {
  // 1. Try decoding JWT Token if present in req.body.TokenId or authorization header
  const token = req.body?.TokenId || req.body?.token || (req.headers?.authorization && req.headers.authorization.split(' ')[1]);
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded && (decoded.id || decoded.username)) {
        return decoded.id || decoded.username;
      }
    } catch (e) {
      // Ignore token decode error
    }
  }

  return (
    req.body?.UserId ||
    req.body?.userId ||
    req.body?.user_id ||
    req.body?.UserID ||
    req.body?.ContactId ||
    req.body?.contactId ||
    req.body?.ContactID ||
    req.body?.TeacherId ||
    req.body?.teacherId ||
    req.body?.teacher_id ||
    req.body?.StaffId ||
    req.body?.staffId ||
    req.body?.staff_id ||
    req.body?.EmployeeId ||
    req.body?.employeeId ||
    req.body?.id ||
    req.query?.UserId ||
    req.query?.userId ||
    req.query?.user_id ||
    req.query?.UserID ||
    req.query?.ContactId ||
    req.query?.contactId ||
    req.query?.TeacherId ||
    req.query?.teacherId ||
    req.query?.teacher_id ||
    req.query?.StaffId ||
    req.query?.staffId ||
    req.query?.staff_id ||
    req.query?.id ||
    req.body?.objContactInfo?.UserId ||
    req.body?.objContactInfo?.ContactId ||
    req.body?.objContactInfo?.id ||
    req.body?.ContactInfo?.UserId ||
    req.body?.ContactInfo?.ContactId ||
    req.body?.objDeviceUserInfo?.UserId ||
    req.body?.objDeviceUserInfo?.ContactId ||
    req.user?.id ||
    req.user?.username ||
    req.headers?.['user-id'] ||
    req.headers?.['userid'] ||
    req.headers?.['contact-id']
  );
}

// Get Contact Details
async function getContactDetails(req, res) {
  const rawId = extractUserId(req);
  console.log('getContactDetails request - URL:', req.originalUrl, 'rawId:', rawId, 'body:', req.body, 'query:', req.query);

  try {
    let rows = [];
    if (rawId) {
      const padded1 = String(rawId).padStart(2, '0');
      const padded2 = String(rawId).padStart(3, '0');
      const [qRows] = await db.query(
        `SELECT * FROM staff 
         WHERE staff_id = $1::text OR staff_id = $2::text OR staff_id = $3::text OR LOWER(username) = LOWER($1::text) OR id::text = $1::text
         ORDER BY CASE 
           WHEN staff_id = $1::text THEN 1 
           WHEN staff_id = $2::text THEN 2 
           WHEN staff_id = $3::text THEN 3 
           WHEN LOWER(username) = LOWER($1::text) THEN 4 
           WHEN id::text = $1::text THEN 5 
           ELSE 6 
         END
         LIMIT 1`,
        [String(rawId), padded1, padded2]
      );
      rows = qRows;
    }

    if (rows.length === 0) {
      const [fallbackRows] = await db.query('SELECT * FROM staff WHERE is_active = true ORDER BY id LIMIT 1');
      rows = fallbackRows;
    }

    if (rows.length === 0) {
      return res.json({ Status: 0, Message: 'Contact not found' });
    }

    const t = rows[0];
    const payload = buildStaffPayload(t);

    res.json({
      ...payload,
      objContactInfo: payload,
      objDeviceUserInfo: payload,
      data: payload,
      Status: 1,
      Message: 'Contact details fetched successfully',
      Exception: null
    });
  } catch (err) {
    console.error('getContactDetails error:', err);
    res.json({ Status: 0, Message: 'Failed to fetch contact details', Exception: err.message });
  }
}

// Sync Teacher Info
async function syncTeacherInfo(req, res) {
  const rawId = extractUserId(req);
  const requestedClasses = Array.isArray(req.body?.classes) ? req.body.classes : [];
  try {
    let query = 'SELECT * FROM staff WHERE is_active = true';
    let params = [];
    if (rawId) {
      const padded1 = String(rawId).padStart(2, '0');
      query += ' AND (id::text = $1::text OR staff_id = $1::text OR staff_id = $2::text OR LOWER(username) = LOWER($1::text))';
      params.push(String(rawId), padded1);
    }
    const [rows] = await db.query(query, params);
    const teacherList = rows.map(t => buildStaffPayload(t));
    const teacher = teacherList[0] || {};
    res.json({
      objTeacherInfoList: teacherList,
      objContactInfoList: teacherList,
      objDeviceUserInfoList: teacherList,
      data: teacherList,
      UserId: rawId || null,
      userId: rawId || null,
      user_id: rawId || null,
      first_name: req.body?.first_name || teacher.first_name || null,
      last_name: req.body?.last_name || teacher.last_name || null,
      classes: requestedClasses,
      classList: requestedClasses,
      Status: 1,
      Message: 'Teacher info synced successfully',
      Exception: null
    });
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to sync teacher info', Exception: err.message });
  }
}

module.exports = {
  login,
  deviceLogin,
  adminLogin,
  changePassword,
  getContactDetails,
  syncTeacherInfo
};
