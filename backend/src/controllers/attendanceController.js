const db = require('../config/db');

// Helper to extract clean HH:MM:SS time string for PostgreSQL TIME data type
function extractTime(val) {
  if (!val) return new Date().toTimeString().split(' ')[0];
  const s = String(val).trim();
  if (s.includes('T')) {
    const timePart = s.split('T')[1];
    return timePart.split('.')[0].split('Z')[0].slice(0, 8);
  }
  if (s.includes(' ')) {
    const timePart = s.split(' ')[1];
    return timePart.slice(0, 8);
  }
  if (s.length > 8) {
    return s.slice(0, 8);
  }
  return s;
}

// Submit Attendance Session (standard REST)
async function submitAttendance(req, res) {
  const {
    classId,
    teacherId,
    sessionDate,
    sessionTime,
    totalStudents,
    presentCount,
    absentCount,
    latitude,
    longitude,
    locationAddress,
    records,
    imageUrls
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const targetDate = sessionDate || new Date().toISOString().split('T')[0];
    const targetTime = extractTime(sessionTime);

    // Create session record
    const [sessionRows, sessionResult] = await conn.query(
      `INSERT INTO attendance_sessions 
      (class_id, teacher_id, session_date, session_time, total_students, present_count, absent_count, latitude, longitude, location_address, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted') RETURNING id`,
      [classId, teacherId, targetDate, targetTime, totalStudents, presentCount, absentCount, latitude, longitude, locationAddress]
    );

    const sessionId = sessionResult.insertId;

    // Create individual records
    if (records && records.length > 0) {
      for (const r of records) {
        const attStatus = r.status === 'present' ? 'present' : 'absent';
        await conn.query(
          `INSERT INTO attendance_records 
          (session_id, student_id, status, confidence_score, recognition_method, remarks) 
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            sessionId,
            r.studentId,
            attStatus,
            r.confidence || null,
            r.recognitionMethod || 'manual',
            r.remarks || ''
          ]
        );

        // Upsert into student_attendance for Web Portal!
        const [sInfo] = await conn.query('SELECT org_id FROM students WHERE id = $1', [r.studentId]);
        const sOrgId = sInfo.length > 0 ? sInfo[0].org_id : 1;
        await conn.query(
          `INSERT INTO student_attendance (student_id, org_id, date, check_in, status, mode, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (student_id, date) DO UPDATE SET
             status = EXCLUDED.status, mode = EXCLUDED.mode, check_in = COALESCE(EXCLUDED.check_in, student_attendance.check_in)`,
          [r.studentId, sOrgId, targetDate, targetTime, attStatus, 'device', r.remarks || null]
        );
      }
    }

    // Save session images
    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        await conn.query(
          `INSERT INTO session_images (session_id, image_path, image_url, upload_status) 
          VALUES ($1, $2, $3, 'uploaded') RETURNING id`,
          [sessionId, url, url]
        );
      }
    }

    await conn.commit();
    res.json({
      success: true,
      message: 'Attendance submitted successfully',
      data: {
        sessionId: sessionId,
        total: totalStudents,
        present: presentCount,
        absent: absentCount,
        submittedAt: Date.now()
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('submitAttendance error:', err);
    res.status(500).json({ success: false, message: 'Database submission failed: ' + err.message });
  } finally {
    conn.release();
  }
}

// Bulk Attendance Mark (device REST)
async function bulkAttendanceMark(req, res) {
  const { objDeviceMachineRawPunchInfo, UserId } = req.body;
  console.log('bulkAttendanceMark request - UserId:', UserId, 'Punches:', objDeviceMachineRawPunchInfo?.objAttenanceMarkFor?.length);

  if (!objDeviceMachineRawPunchInfo) {
    return res.json({ Status: 0, Message: 'Missing punch info' });
  }

  const { objAttenanceMarkFor } = objDeviceMachineRawPunchInfo;
  if (!objAttenanceMarkFor || objAttenanceMarkFor.length === 0) {
    return res.json({ Status: 1, Message: 'No punches to process' });
  }

  const firstPunch = objAttenanceMarkFor[0];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

      const rawPayload = JSON.stringify(req.body);
    const rawMeta = objDeviceMachineRawPunchInfo;
    for (const punch of objAttenanceMarkFor) {
        const studentIdentifier = punch.AdmNo || punch.admNo || punch.AdmissionNo || punch.admissionNo || punch.RollNo || punch.rollNo || punch.RollNumber || punch.rollNumber || punch.StudentId || punch.studentId || punch.StudentID;
        let rawStudentId = null;
        if (studentIdentifier != null && String(studentIdentifier).trim() !== '') {
          const [rawStudentRows] = await conn.query(
            `SELECT id FROM students
             WHERE admission_no = $1 OR roll_no = $1 OR roll_number = $1 OR id::text = $1::text
             ORDER BY CASE
               WHEN admission_no = $1 THEN 1
               WHEN roll_no = $1 THEN 2
               WHEN roll_number = $1 THEN 3
               ELSE 4
             END, id
             LIMIT 1`,
            [String(studentIdentifier)]
          );
          rawStudentId = rawStudentRows[0]?.id || null;
        }
      await conn.query(
        `INSERT INTO student_attendance_raw_logs
           (customer_id, token_id, user_id, user_type, db_operation, capture_mode, device_id, machine_id, period,
            student_id, admission_no, punch_time, latitude, longitude, raw_payload, raw_punch)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)`,
        [
          rawMeta.CustomerId || null,
          req.body.TokenId || null,
          UserId || null,
          req.body.UserType || null,
          req.body.dbOperation || null,
          rawMeta.CaptureMode || null,
          rawMeta.DeviceId || null,
          rawMeta.MachineId == null ? null : String(rawMeta.MachineId),
          rawMeta.Period || null,
          rawStudentId,
          studentIdentifier || null,
          punch.PunchTime || punch.punchTime || punch.Time || null,
          punch.Latitude ?? punch.latitude ?? null,
          punch.Longitude ?? punch.longitude ?? null,
          rawPayload,
          JSON.stringify(punch)
        ]
      );
    }

    const sessionDate = new Date().toISOString().split('T')[0];
    const sessionTime = extractTime(new Date().toTimeString().split(' ')[0]);

    // Resolve teacher staff record
    let teacherDbId = 1;
    let orgId = 1;
    if (UserId) {
      const [tRows] = await conn.query(
        'SELECT id, org_id FROM staff WHERE id::text = $1::text OR staff_id = $1::text OR LOWER(username) = LOWER($1) LIMIT 1',
        [String(UserId)]
      );
      if (tRows.length > 0) {
        teacherDbId = tRows[0].id;
        orgId = tRows[0].org_id;
      }
    }

    // Resolve classId & timetableSlotId
    let classId = req.body?.classId || req.body?.class_id || 1;
    const timetableSlotId = req.body?.timetableSlotId || req.body?.timetable_slot_id || objDeviceMachineRawPunchInfo?.timetableSlotId || firstPunch?.timetableSlotId || firstPunch?.timetable_slot_id || firstPunch?.SlotId || firstPunch?.slotId || null;

    const admNo = firstPunch.AdmNo || firstPunch.AdmissionNo || firstPunch.RollNo || firstPunch.StudentId;
    if (admNo) {
      const [stuRows] = await conn.query(
        'SELECT class_id, org_id FROM students WHERE admission_no = $1 OR roll_number = $1 OR roll_no = $1 OR id::text = $1::text LIMIT 1',
        [String(admNo)]
      );
      if (stuRows.length > 0) {
        if (stuRows[0].class_id) classId = stuRows[0].class_id;
        if (stuRows[0].org_id) orgId = stuRows[0].org_id;
      }
    }

    // Insert attendance session
    const [sessionRows, sessionResult] = await conn.query(
      `INSERT INTO attendance_sessions 
      (class_id, teacher_id, session_date, session_time, total_students, present_count, absent_count, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted') RETURNING id`,
      [classId, teacherDbId, sessionDate, sessionTime, objAttenanceMarkFor.length, objAttenanceMarkFor.length, 0]
    );
    const sessionId = sessionResult.insertId;

    // Process each punch
    for (const punch of objAttenanceMarkFor) {
      const studentIdentifier = 
        punch.AdmNo || 
        punch.admNo || 
        punch.AdmissionNo || 
        punch.admissionNo || 
        punch.RollNo || 
        punch.rollNo || 
        punch.RollNumber || 
        punch.rollNumber || 
        punch.StudentId || 
        punch.studentId || 
        punch.StudentID || 
        punch.ID || 
        punch.Id || 
        punch.id || 
        punch.RollNum || 
        punch.rollNum ||
        punch.ContactId ||
        punch.contactId ||
        punch.UserNo ||
        punch.userNo ||
        punch.EmpNo ||
        punch.empNo ||
        punch.Code ||
        punch.code;

      let student = null;

      if (studentIdentifier) {
        const strId = String(studentIdentifier);
        const padId = strId.padStart(2, '0');
        const [stuRows] = await conn.query(
          `SELECT id, org_id, class_id FROM students 
           WHERE admission_no = $1 OR roll_number = $1 OR roll_no = $1 OR id::text = $1::text 
              OR admission_no = $2 OR roll_number = $2 OR roll_no = $2 OR id::text = $2::text
           LIMIT 1`,
          [strId, padId]
        );
        if (stuRows.length > 0) student = stuRows[0];
      }

      const punchTime = extractTime(punch.PunchTime || punch.punchTime || punch.Time || sessionTime);
      const punchStatus = (punch.Status || punch.status || punch.AttendanceStatus || punch.attendanceStatus || 'present').toLowerCase() === 'absent' ? 'absent' : 'present';

      if (student) {
        console.log(`[bulkAttendanceMark] Matched Student ID ${student.id} for identifier "${studentIdentifier}"`);

        // 1. Insert into attendance_records
        await conn.query(
          `INSERT INTO attendance_records 
          (session_id, student_id, status, confidence_score, recognition_method, remarks) 
          VALUES ($1, $2, $3, $4, 'face', 'Marked via Attendance Device')
          ON CONFLICT (session_id, student_id) DO UPDATE SET status=EXCLUDED.status, confidence_score=EXCLUDED.confidence_score RETURNING id`,
          [sessionId, student.id, punchStatus, punch.Confidence || punch.confidence || 0.95]
        );

        // 2. Upsert into student_attendance table so it reflects on Web Portal!
        await conn.query(
          `INSERT INTO student_attendance (student_id, org_id, date, check_in, status, mode, notes)
           VALUES ($1, $2, $3, $4, $5, 'device', 'Marked via Attendance Device')
           ON CONFLICT (student_id, date) DO UPDATE SET
             check_in = COALESCE(EXCLUDED.check_in, student_attendance.check_in),
             status = EXCLUDED.status,
             mode = 'device'`,
          [student.id, student.org_id || orgId, sessionDate, punchTime, punchStatus]
        );

        if (punch.PunchPhotoUrl || punch.punchPhotoUrl || punch.PhotoUrl || punch.photoUrl) {
          const photoUrl = punch.PunchPhotoUrl || punch.punchPhotoUrl || punch.PhotoUrl || punch.photoUrl;
          await conn.query(
            `INSERT INTO session_images (session_id, image_path, image_url, upload_status) VALUES ($1, $2, $3, 'uploaded') RETURNING id`,
            [sessionId, photoUrl, photoUrl]
          );
        }
      } else if (punch.BiometricId || punch.biometricId || punch.UserId || punch.userId) {
        // Teacher / Staff self punch log
        const staffIdent = punch.BiometricId || punch.biometricId || punch.UserId || punch.userId || UserId;
        const strStf = String(staffIdent);
        const padStf = strStf.padStart(2, '0');
        const [stfRows] = await conn.query(
          'SELECT id, org_id FROM staff WHERE id::text = $1 OR staff_id = $1 OR biometric_id = $1 OR id::text = $2 OR staff_id = $2 OR LOWER(username) = LOWER($1) LIMIT 1',
          [strStf, padStf]
        );
        

        if (stfRows.length > 0) {
          const stf = stfRows[0];
          console.log(`[bulkAttendanceMark] Matched Staff ID ${stf.id} for identifier "${staffIdent}"`);
          await conn.query(
            `INSERT INTO staff_attendance_punches (staff_id, org_id, date, punch_time, mode)
             VALUES ($1, $2, $3, $4, 'device')`,
            [stf.id, stf.org_id, sessionDate, punchTime]
          );
          // Upsert into staff_attendance table for Web Portal!
          await conn.query(
            `INSERT INTO staff_attendance (staff_id, org_id, date, check_in, shift_status, mode, notes)
             VALUES ($1, $2, $3, $4, 'present', 'device', 'Marked via Attendance Device')
             ON CONFLICT (staff_id, date) DO UPDATE SET
               check_in = COALESCE(staff_attendance.check_in, EXCLUDED.check_in),
               check_out = CASE
                 WHEN staff_attendance.check_in IS NOT NULL THEN EXCLUDED.check_in
                 ELSE staff_attendance.check_out
               END,
               shift_status = 'present',
               mode = 'device'`,
            [stf.id, stf.org_id, sessionDate, punchTime]
          );
        }

        await conn.query(
          `INSERT INTO attendance_logs (enroll_id, name, timestamp, latitude, longitude, method) 
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [staffIdent, 'Teacher Self', Date.now(), punch.Latitude || punch.latitude || '0.00000000', punch.Longitude || punch.longitude || '0.00000000', 'face']
        );
      }
    }

    await conn.commit();
    res.json({ Status: 1, Message: 'Bulk attendance marked successfully', Exception: null });
  } catch (err) {
    await conn.rollback();
    console.error('bulkAttendanceMark error:', err);
    res.json({ Status: 0, Message: 'Bulk attendance marking failed', Exception: err.message });
  } finally {
    conn.release();
  }
}

// Teacher self attendance log
async function submitTeacherAttendance(req, res) {
  const { UserId, Latitude, Longitude } = req.body;
  const sessionDate = new Date().toISOString().split('T')[0];
  const sessionTime = extractTime(new Date().toTimeString().split(' ')[0]);

  try {
    await db.query(
      `INSERT INTO teacher_attendance_raw_logs
       (customer_id, token_id, user_id, user_type, contact_id, biometric_id, source, device_id,
        punch_time, latitude, longitude, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
      [
        req.body.CustomerId || null,
        req.body.TokenId || null,
        UserId || null,
        req.body.UserType || null,
        req.body.ContactId || null,
        req.body.BiometricId || UserId || null,
        req.body.Source || null,
        req.body.DeviceId || null,
        req.body.PunchTime || null,
        Latitude ?? null,
        Longitude ?? null,
        JSON.stringify(req.body)
      ]
    );

    const [tRows] = await db.query(
      'SELECT id, org_id FROM staff WHERE id::text = $1::text OR staff_id = $1::text OR LOWER(username) = LOWER($1) LIMIT 1',
      [String(UserId)]
    );

    if (tRows.length > 0) {
      const stf = tRows[0];
      await db.query(
        `INSERT INTO staff_attendance_punches (staff_id, org_id, date, punch_time, mode)
         VALUES ($1, $2, $3, $4, 'device')`,
        [stf.id, stf.org_id, sessionDate, sessionTime]
      );
      await db.query(
        `INSERT INTO staff_attendance (staff_id, org_id, date, check_in, shift_status, mode, notes)
         VALUES ($1, $2, $3, $4, 'present', 'device', 'Marked via Attendance Device')
         ON CONFLICT (staff_id, date) DO UPDATE SET
           check_in = COALESCE(staff_attendance.check_in, EXCLUDED.check_in),
           check_out = CASE
             WHEN staff_attendance.check_in IS NOT NULL THEN EXCLUDED.check_in
             ELSE staff_attendance.check_out
           END,
           shift_status = 'present',
           mode = 'device'`,
        [stf.id, stf.org_id, sessionDate, sessionTime]
      );
    }

    const [rows, result] = await db.query(
      `INSERT INTO attendance_logs (person_id, enroll_id, name, timestamp, latitude, longitude, method) 
      VALUES ($1, $2, $3, $4, $5, $6, 'face') RETURNING id`,
      [UserId, UserId, 'Teacher Self-Punch', Date.now(), Latitude, Longitude]
    );

    res.json({
      Status: 1,
      Message: 'Teacher attendance recorded successfully',
      Exception: null,
      AttendanceId: result.insertId
    });
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to submit self-attendance', Exception: err.message });
  }
}

// Get Monthly Attendance logs list
async function getContactMonthlyAttendance(req, res) {
  const { UserId, Year, Month } = req.body;

  try {
    const startDate = `${Year}-${String(Month).padStart(2, '0')}-01`;
    const endDate = `${Year}-${String(Month).padStart(2, '0')}-31`;

    const [rows] = await db.query(
      `SELECT session_date, MIN(session_time) as in_time, MAX(session_time) as out_time 
      FROM attendance_sessions 
      WHERE teacher_id::text = $1::text AND session_date BETWEEN $2 AND $3 
      GROUP BY session_date`,
      [String(UserId), startDate, endDate]
    );

    const displayId = String(UserId || '01').padStart(2, '0');
    const logs = rows.map(r => {
      const dateStr = new Date(r.session_date).toISOString().split('T')[0];
      return {
        ContactId: displayId,
        UserId: displayId,
        MonthDate: dateStr,
        WeakDay: new Date(r.session_date).toLocaleDateString('en-US', { weekday: 'long' }),
        InTime: r.in_time,
        OutTime: r.out_time,
        WorkingHours: '8 hrs',
        Attendance: 'Present',
        InPunchPhotoUrl: null,
        OutPunchPhotoUrl: null,
        objGEOLocations: []
      };
    });

    res.json({
      objContactAttendanceInfoList: logs,
      Status: 1,
      Message: 'Report loaded',
      Exception: null
    });
  } catch (err) {
    res.json({ Status: 0, Message: 'Report failed', Exception: err.message });
  }
}

// Get Monthly Attendance counts
async function getContactMonthlyAttendanceCount(req, res) {
  const { UserId } = req.body;
  const displayId = String(UserId || '01').padStart(2, '0');
  res.json({
    objContactMonthlyAttendanceInfoList: [
      { ContactId: displayId, UserId: displayId, Month: 'August', WorkingDays: 22, Present: 20, Absent: 2, Leaves: 0, Holiday: 0, WeaklyOff: 8 }
    ],
    Status: 1,
    Message: 'Success',
    Exception: null
  });
}

// Get Daily Attendance summary
async function getDailyAttendance(req, res) {
  res.json({
    TotalCount: 1,
    Present: 1,
    Absent: 0,
    objDailyAttendanceInfoList: [
      { GroupName: 'Teachers', SubGroupName: 'Math', TotalCount: 1, Present: 1, Absent: 0 }
    ],
    Status: 1,
    Message: 'Success'
  });
}

// Get Daily Chart Attendance info
function getDailyChartAttendance(req, res) {
  res.json({
    ChartData: [{ ChartLabel: 'Math', ChartStepSize: 1, ChartTitle: 'Daily Present', ChartType: 'bar' }],
    Status: 1
  });
}

// Download report file
function downloadReport(req, res) {
  res.json({ ReportPath: '/reports/dummy.pdf', Status: 1 });
}

// Get Academic Holidays list
async function getHolidayDetails(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM holidays');
    const holidays = rows.map(r => ({
      HolidayId: r.id,
      CustID: r.cust_id,
      HolidayDate: r.holiday_date || r.date,
      HolidayToDate: r.holiday_to_date || r.date,
      HolidayDesc: r.holiday_desc || r.description || r.name,
      IsRange: r.is_range || 0,
      UserId: r.user_id
    }));
    res.json({ objHolidayInfoList: holidays, Status: 1 });
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to retrieve holidays', Exception: err.message });
  }
}

// Get Leaves Type list
async function getLeaveMaster(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM leave_masters');
    const leaves = rows.map(r => ({
      Lcode: r.lcode,
      CustID: r.cust_id,
      LshortName: r.lshort_name,
      Ldescription: r.ldescription,
      IsOffInclude: r.is_off_include === true || r.is_off_include === 1,
      IsHolidayInclude: r.is_holiday_include === true || r.is_holiday_include === 1,
      TreatedAsPresent: r.treated_as_present === true || r.treated_as_present === 1,
      LeaveLimit: r.leave_limit,
      IsAutoAcuralAllowed: r.is_auto_accrual_allowed === true || r.is_auto_accrual_allowed === 1,
      IsCarriedForward: r.is_carried_forward === true || r.is_carried_forward === 1,
      MaxContinuousLeave: r.max_continuous_leave
    }));
    res.json({ objLeaveMasterInfo: leaves, Status: 1 });
  } catch (err) {
    res.json({ Status: 0, Exception: err.message });
  }
}

// Save Leave Application
async function saveContactLeave(req, res) {
  const { objContactLeaveInfo, UserId } = req.body;
  if (!objContactLeaveInfo) {
    return res.json({ Status: 0, Message: 'Missing leave details' });
  }

  try {
    await db.query(
      `INSERT INTO contact_leaves (lcode, contact_id, application_date, start_date, end_date, leave_amount, leave_amt_type, leave_reason, status, leave_status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'Pending') RETURNING id`,
      [
        objContactLeaveInfo.LCode,
        UserId,
        objContactLeaveInfo.ApplicationDate,
        objContactLeaveInfo.StartDate,
        objContactLeaveInfo.EndDate,
        objContactLeaveInfo.LeaveAmount || 1.0,
        objContactLeaveInfo.LeaveAmtType || 0,
        objContactLeaveInfo.LeaveReason || ''
      ]
    );

    res.json({ Status: 1, Message: 'Leave saved successfully' });
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to save leave', Exception: err.message });
  }
}

// Get Leave Balance
async function getContactLeaveBalance(req, res) {
  res.json({
    objContactLeaveBalanceInfoList: [
      { LeaveYear: '2026', LshortName: 'CL', LeaveAllowedCYear: 12.0, LeaveAllowedPYear: 0.0, LeaveTaken: 2.0 }
    ],
    Status: 1
  });
}

// Get Contact Leaves status list
async function getContactLeaveStatus(req, res) {
  const { ContactId } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT cl.*, lm.lshort_name 
      FROM contact_leaves cl 
      JOIN leave_masters lm ON cl.lcode = lm.lcode 
      WHERE cl.contact_id = $1`,
      [ContactId]
    );

    const history = rows.map(r => ({
      CName: 'Teacher',
      ApplicationDate: r.application_date,
      StartDate: r.start_date,
      EndDate: r.end_date,
      LeaveAmount: r.leave_amount,
      LshortName: r.lshort_name,
      LeaveReason: r.leave_reason,
      Status: r.status,
      LeaveStatus: r.leave_status
    }));

    res.json({ objContactLeaveStatusInfoList: history, Status: 1 });
  } catch (err) {
    res.json({ Status: 0, Exception: err.message });
  }
}

module.exports = {
  submitAttendance,
  bulkAttendanceMark,
  submitTeacherAttendance,
  getContactMonthlyAttendance,
  getContactMonthlyAttendanceCount,
  getDailyAttendance,
  getDailyChartAttendance,
  downloadReport,
  getHolidayDetails,
  getLeaveMaster,
  saveContactLeave,
  getContactLeaveBalance,
  getContactLeaveStatus
};
