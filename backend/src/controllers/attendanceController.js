const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { generateMonthlyAttendancePdf, generateDailyAttendancePdf } = require('../utils/attendancePdf');

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

function calculateWorkingHours(date, inTime, outTime) {
  if (!inTime || !outTime) return 'Punch out pending';

  const inDate = new Date(`${date}T${String(inTime).slice(0, 8)}`);
  const outDate = new Date(`${date}T${String(outTime).slice(0, 8)}`);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) {
    return 'Punch out pending';
  }

  let durationSeconds = Math.floor((outDate.getTime() - inDate.getTime()) / 1000);
  if (durationSeconds < 0) durationSeconds += 24 * 60 * 60;

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  const parts = [`${hours} hrs`];
  if (minutes || seconds) parts.push(`${minutes} mins`);
  if (seconds) parts.push(`${seconds} secs`);
  return parts.join(' ');
}

async function resolveReportStaff(identifier) {
  if (!identifier) return null;

  const [rows] = await db.query(
    `SELECT s.id, s.org_id, s.staff_id, s.full_name, s.role_type, s.designation,
            o.name AS org_name, o.address AS org_address, o.phone AS org_phone, o.email AS org_email
     FROM staff s
     LEFT JOIN organisations o ON o.id = s.org_id
    WHERE s.is_active = true
       AND (s.id::text = $1 OR s.staff_id = $1 OR LOWER(s.username) = LOWER($1))
     LIMIT 1`,
    [String(identifier)]
  );

  return rows[0] || null;
}

function getReportPeriod(body) {
  const year = Number(body.Year ?? body.year ?? new Date().getFullYear());
  const month = Number(body.Month ?? body.month ?? new Date().getMonth() + 1);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Valid Year and Month are required');
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const dateValue = value => value.toISOString().slice(0, 10);

  return {
    year,
    month,
    startDate: dateValue(start),
    nextDate: dateValue(next),
    monthName: start.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  };
}

async function getAttendanceCalendar(staff, period) {
  const [attendanceRows, sessionRows, leaveRows, holidayRows] = await Promise.all([
    db.query(
      `SELECT date::text AS date, shift_status AS status, check_in, check_out
       FROM staff_attendance
       WHERE staff_id = $1 AND org_id = $2
         AND date >= $3 AND date < $4`,
      [staff.id, staff.org_id, period.startDate, period.nextDate]
    ),
    db.query(
      `SELECT session_date::text AS date,
              MIN(session_time) AS check_in,
              MAX(session_time) AS check_out
       FROM attendance_sessions
       WHERE teacher_id = $1
         AND session_date >= $2 AND session_date < $3
       GROUP BY session_date`,
      [staff.id, period.startDate, period.nextDate]
    ),
    db.query(
      `SELECT TO_CHAR(day_value, 'YYYY-MM-DD') AS date
       FROM leaves l
       CROSS JOIN LATERAL generate_series(
         GREATEST(l.from_date, $3::date),
         LEAST(l.to_date, ($4::date - INTERVAL '1 day')::date),
         INTERVAL '1 day'
       ) AS day_value
       WHERE l.staff_id = $1
         AND l.org_id = $2
         AND LOWER(COALESCE(l.status, '')) IN ('approved', 'informed')
         AND l.from_date < $4::date
         AND l.to_date >= $3::date`,
      [staff.id, staff.org_id, period.startDate, period.nextDate]
    ),
    db.query(
      `SELECT TO_CHAR(COALESCE(holiday_date, date), 'YYYY-MM-DD') AS date
       FROM holidays
       WHERE org_id = $1
         AND COALESCE(holiday_date, date) >= $2::date
         AND COALESCE(holiday_date, date) < $3::date`,
      [staff.org_id, period.startDate, period.nextDate]
    )
  ]);

  const attendanceByDate = new Map();
  for (const row of attendanceRows[0]) attendanceByDate.set(row.date, row);
  for (const row of sessionRows[0]) {
    if (!attendanceByDate.has(row.date)) attendanceByDate.set(row.date, row);
  }

  const leaveDates = new Set(leaveRows[0].map(row => row.date));
  const holidayDates = new Set(holidayRows[0].map(row => row.date));
  const days = [];
  const cursor = new Date(`${period.startDate}T00:00:00Z`);
  const end = new Date(`${period.nextDate}T00:00:00Z`);

  while (cursor < end) {
    const date = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay();
    const attendance = attendanceByDate.get(date);
    let status = 'absent';

    if (holidayDates.has(date)) status = 'holiday';
    else if (dayOfWeek === 0 || dayOfWeek === 6) status = 'weekly_off';
    else if (leaveDates.has(date)) status = 'leave';
    else if (attendance && ['present', 'late'].includes(String(attendance.status || '').toLowerCase())) status = 'present';

    days.push({
      date,
      status,
      checkIn: attendance?.check_in || null,
      checkOut: attendance?.check_out || null
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
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
          'SELECT id, org_id, expected_check_in, expected_check_out FROM staff WHERE id::text = $1 OR staff_id = $1 OR biometric_id = $1 OR id::text = $2 OR staff_id = $2 OR LOWER(username) = LOWER($1) LIMIT 1',
          [strStf, padStf]
        );
        

        if (stfRows.length > 0) {
          const stf = stfRows[0];
          await conn.query(
            `INSERT INTO staff_attendance_punches (staff_id, org_id, date, punch_time, mode)
             VALUES ($1, $2, $3, $4, 'device')`,
            [stf.id, stf.org_id, sessionDate, punchTime]
          );

          // Check if an existing check_in already exists today
          const [existingAtt] = await conn.query(
            'SELECT check_in, check_out, shift_status FROM staff_attendance WHERE staff_id = $1 AND date = $2',
            [stf.id, sessionDate]
          );

          let checkInVal = punchTime;
          let checkOutVal = null;
          let status = 'present';

          if (existingAtt.length > 0 && existingAtt[0].check_in) {
            checkInVal = existingAtt[0].check_in;
            checkOutVal = punchTime;
            status = calculateStaffAttendanceStatus(
              checkInVal,
              checkOutVal,
              stf.expected_check_in,
              stf.expected_check_out
            );
          } else {
            status = calculateStaffAttendanceStatus(
              checkInVal,
              null,
              stf.expected_check_in,
              stf.expected_check_out
            );
          }

          console.log(`[bulkAttendanceMark] Matched Staff ID ${stf.id} for identifier "${staffIdent}", punchTime: ${punchTime}, status: ${status}`);

          // Upsert into staff_attendance table for Web Portal!
          await conn.query(
            `INSERT INTO staff_attendance (staff_id, org_id, date, check_in, check_out, shift_status, mode, notes)
             VALUES ($1, $2, $3, $4, $5, $6, 'device', 'Marked via Attendance Device')
             ON CONFLICT (staff_id, date) DO UPDATE SET
               check_in = COALESCE(staff_attendance.check_in, EXCLUDED.check_in),
               check_out = COALESCE(EXCLUDED.check_out, staff_attendance.check_out),
               shift_status = EXCLUDED.shift_status,
               mode = 'device'`,
            [stf.id, stf.org_id, sessionDate, checkInVal, checkOutVal, status]
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
      'SELECT id, org_id, expected_check_in, expected_check_out FROM staff WHERE id::text = $1::text OR staff_id = $1::text OR LOWER(username) = LOWER($1) LIMIT 1',
      [String(UserId)]
    );

    if (tRows.length > 0) {
      const stf = tRows[0];
      await db.query(
        `INSERT INTO staff_attendance_punches (staff_id, org_id, date, punch_time, mode)
         VALUES ($1, $2, $3, $4, 'device')`,
        [stf.id, stf.org_id, sessionDate, sessionTime]
      );

      const [existingAtt] = await db.query(
        'SELECT check_in, check_out, shift_status FROM staff_attendance WHERE staff_id = $1 AND date = $2',
        [stf.id, sessionDate]
      );

      let checkInVal = sessionTime;
      let checkOutVal = null;
      let status = 'present';

      if (existingAtt.length > 0 && existingAtt[0].check_in) {
        checkInVal = existingAtt[0].check_in;
        checkOutVal = sessionTime;
        status = calculateStaffAttendanceStatus(
          checkInVal,
          checkOutVal,
          stf.expected_check_in,
          stf.expected_check_out
        );
      } else {
        status = calculateStaffAttendanceStatus(
          checkInVal,
          null,
          stf.expected_check_in,
          stf.expected_check_out
        );
      }

      await db.query(
        `INSERT INTO staff_attendance (staff_id, org_id, date, check_in, check_out, shift_status, mode, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'device', 'Marked via Attendance Device')
         ON CONFLICT (staff_id, date) DO UPDATE SET
           check_in = COALESCE(staff_attendance.check_in, EXCLUDED.check_in),
           check_out = COALESCE(EXCLUDED.check_out, staff_attendance.check_out),
           shift_status = EXCLUDED.shift_status,
           mode = 'device'`,
        [stf.id, stf.org_id, sessionDate, checkInVal, checkOutVal, status]
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
  try {
    const staff = await resolveReportStaff(req.body.UserId);
    if (!staff) return res.json({ Status: 0, Message: 'Staff member not found' });
    const period = getReportPeriod(req.body);

    const [rows] = await db.query(
      `SELECT TO_CHAR(attendance_date, 'YYYY-MM-DD') AS session_date,
              MIN(in_time) AS in_time,
              MAX(out_time) AS out_time
       FROM (
         SELECT date AS attendance_date, check_in AS in_time, check_out AS out_time
         FROM staff_attendance
         WHERE staff_id = $1 AND org_id = $4
           AND date >= $2 AND date < $3
         UNION ALL
         SELECT session_date AS attendance_date, session_time AS in_time, NULL AS out_time
         FROM attendance_sessions
         WHERE teacher_id = $1
           AND session_date >= $2 AND session_date < $3
       ) attendance
       GROUP BY attendance_date
       ORDER BY attendance_date`,
      [staff.id, period.startDate, period.nextDate, staff.org_id]
    );

    const logs = rows.map(r => {
      const dateStr = r.session_date;
      return {
        ContactId: String(staff.staff_id || staff.id),
        UserId: String(staff.staff_id || staff.id),
        MonthDate: dateStr,
        WeakDay: new Date(r.session_date).toLocaleDateString('en-US', { weekday: 'long' }),
        InTime: r.in_time,
        OutTime: r.out_time,
        WorkingHours: calculateWorkingHours(dateStr, r.in_time, r.out_time),
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
  try {
    const staff = await resolveReportStaff(req.body.UserId);
    if (!staff) return res.json({ Status: 0, Message: 'Staff member not found' });
    const year = Number(req.body.Year ?? req.body.year ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 1) {
      return res.json({ Status: 0, Message: 'Valid Year is required' });
    }

    const monthlySummaries = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const period = getReportPeriod({ Year: year, Month: index + 1 });
        const today = new Date();
        const isCurrentMonth =
          year === today.getFullYear() &&
          index + 1 === today.getMonth() + 1;

        if (isCurrentMonth) {
          const tomorrow = new Date(Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
          ));
          period.nextDate = tomorrow.toISOString().slice(0, 10);
        }

        return getAttendanceCalendar(staff, period).then(days => {
          const counts = days.reduce((result, day) => {
            if (day.status === 'present') result.present += 1;
            else if (day.status === 'absent') result.absent += 1;
            else if (day.status === 'leave') result.leaves += 1;
            else if (day.status === 'holiday') result.holiday += 1;
            else if (day.status === 'weekly_off') result.weeklyOff += 1;
            return result;
          }, { present: 0, absent: 0, leaves: 0, holiday: 0, weeklyOff: 0 });

          return {
            ContactId: String(staff.staff_id || staff.id),
            UserId: String(staff.staff_id || staff.id),
            Month: period.monthName,
            WorkingDays: counts.present + counts.absent + counts.leaves,
            Present: counts.present,
            Absent: counts.absent,
            Leaves: counts.leaves,
            Holiday: counts.holiday,
            WeaklyOff: counts.weeklyOff,
            AttendanceRate: counts.present + counts.absent > 0
              ? Number(((counts.present / (counts.present + counts.absent)) * 100).toFixed(2))
              : 0
          };
        });
      })
    );

    return res.json({
      objContactMonthlyAttendanceInfoList: monthlySummaries,
      Status: 1,
      Message: 'Success',
      Exception: null
    });
  } catch (err) {
    console.error('getContactMonthlyAttendanceCount:', err);
    return res.json({ Status: 0, Message: 'Report failed', Exception: err.message });
  }
}

// Get Daily Attendance summary
async function getDailyAttendance(req, res) {
  try {
    const staff = await resolveReportStaff(req.body.UserId);
    if (!staff) return res.json({ Status: 0, Message: 'Staff member not found' });
    const targetDate = req.body.Date || req.body.date || new Date().toISOString().split('T')[0];
    const target = new Date(`${targetDate}T00:00:00Z`);
    if (Number.isNaN(target.getTime())) return res.json({ Status: 0, Message: 'Invalid date' });
    const period = getReportPeriod({ Year: target.getUTCFullYear(), Month: target.getUTCMonth() + 1 });
    const day = (await getAttendanceCalendar(staff, period)).find(item => item.date === targetDate);
    const isPresent = day?.status === 'present';
    const isAbsent = day?.status === 'absent';

    return res.json({
      TotalCount: 1,
      Present: isPresent ? 1 : 0,
      Absent: isAbsent ? 1 : 0,
      objDailyAttendanceInfoList: [{
        GroupName: 'Teachers',
        SubGroupName: staff.designation || staff.role_type || 'Teacher',
        TotalCount: 1,
        Present: isPresent ? 1 : 0,
        Absent: isAbsent ? 1 : 0,
        Holiday: day?.status === 'holiday' ? 1 : 0,
        Leave: day?.status === 'leave' ? 1 : 0,
        WeaklyOff: day?.status === 'weekly_off' ? 1 : 0
      }],
      Status: 1,
      Message: 'Success'
    });
  } catch (err) {
    console.error('getDailyAttendance:', err);
    return res.json({ Status: 0, Message: 'Report failed', Exception: err.message });
  }
}

// Get Daily Chart Attendance info
async function getDailyChartAttendance(req, res) {
  try {
    const staff = await resolveReportStaff(req.body.UserId);
    if (!staff) return res.json({ Status: 0, Message: 'Staff member not found' });
    const period = getReportPeriod(req.body);
    const days = await getAttendanceCalendar(staff, period);

    return res.json({
      ChartData: days.map(day => ({
        ChartLabel: day.date,
        ChartStepSize: 1,
        ChartTitle: 'Daily Attendance',
        ChartType: 'bar',
        Status: day.status,
        Present: day.status === 'present' ? 1 : 0,
        Absent: day.status === 'absent' ? 1 : 0
      })),
      Status: 1
    });
  } catch (err) {
    console.error('getDailyChartAttendance:', err);
    return res.json({ Status: 0, Message: 'Report failed', Exception: err.message });
  }
}

function durationSeconds(startTime, endTime) {
  const toSeconds = value => {
    const parts = String(value).slice(0, 8).split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };
  let seconds = toSeconds(endTime) - toSeconds(startTime);
  if (seconds < 0) seconds += 24 * 60 * 60;
  return seconds;
}

function formatDuration(seconds) {
  if (!seconds) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map(value => String(value).padStart(2, '0')).join(':');
}

function formatPunches(punches) {
  let currentIn = null;
  let totalSeconds = 0;
  const records = punches.map((time, index) => {
    const isIn = index % 2 === 0;
    if (isIn) {
      currentIn = time;
      return { type: 'Punch in', time, duration: null };
    }
    const seconds = currentIn ? durationSeconds(currentIn, time) : 0;
    totalSeconds += seconds;
    currentIn = null;
    return { type: 'Punch out', time, duration: formatDuration(seconds) };
  });

  const hasPendingPunchOut = Boolean(currentIn);
  if (hasPendingPunchOut) records[records.length - 1].duration = 'Punch out pending';
  return {
    records,
    totalSeconds,
    workingDuration: !records.length
      ? 'No punches recorded'
      : hasPendingPunchOut && totalSeconds === 0
        ? 'Punch out pending'
        : `${formatDuration(totalSeconds)}${hasPendingPunchOut ? ' (punch out pending)' : ''}`,
    punchesText: records.map(record => `${record.type}: ${record.time}`).join('\n') || 'No punches recorded'
  };
}

async function loadReportPunches(staff, period) {
  const [rows] = await db.query(
    `SELECT date::text AS date, TO_CHAR(punch_time, 'HH24:MI:SS') AS punch_time
     FROM staff_attendance_punches
     WHERE staff_id = $1 AND org_id = $2
       AND date >= $3 AND date < $4
     ORDER BY date, punch_time, id`,
    [staff.id, staff.org_id, period.startDate, period.nextDate]
  );
  return rows.reduce((byDate, row) => {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row.punch_time);
    return byDate;
  }, new Map());
}

function getStatusLabel(status) {
  return ({
    present: 'Present',
    absent: 'Absent',
    leave: 'Leave',
    holiday: 'Holiday',
    weekly_off: 'Weekly off'
  })[status] || 'Absent';
}

function makeDownloadUrl(req, fileName) {
  return `${req.protocol}://${req.get('host')}/uploads/reports/${encodeURIComponent(fileName)}`;
}

async function downloadReport(req, res) {
  try {
    const staff = await resolveReportStaff(req.body.UserId || req.body.userId);
    if (!staff) return res.json({ Status: 0, Message: 'Staff member not found' });
    const period = getReportPeriod(req.body);
    const today = new Date();
    if (period.year === today.getFullYear() && period.month === today.getMonth() + 1) {
      period.nextDate = new Date(Date.UTC(
        today.getFullYear(), today.getMonth(), today.getDate() + 1
      )).toISOString().slice(0, 10);
    }
    const [calendar, punchesByDate] = await Promise.all([
      getAttendanceCalendar(staff, period),
      loadReportPunches(staff, period)
    ]);
    const days = calendar.map(day => {
      const punches = punchesByDate.get(day.date) || [day.checkIn, day.checkOut].filter(Boolean);
      const details = formatPunches(punches);
      return {
        date: day.date,
        weekDay: new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        status: getStatusLabel(day.status),
        punchesText: details.punchesText,
        workingDuration: details.workingDuration
      };
    });
    const counts = calendar.reduce((result, day) => {
      if (day.status === 'present') result.present += 1;
      else if (day.status === 'absent') result.absent += 1;
      else if (day.status === 'leave') result.leaves += 1;
      else if (day.status === 'holiday') result.holidays += 1;
      else if (day.status === 'weekly_off') result.weeklyOff += 1;
      return result;
    }, { present: 0, absent: 0, leaves: 0, holidays: 0, weeklyOff: 0 });
    const denominator = counts.present + counts.absent;
    const summary = {
      ...counts,
      workingDays: counts.present + counts.absent + counts.leaves,
      percentage: denominator ? ((counts.present / denominator) * 100).toFixed(2) : '0.00'
    };
    const reportDirectory = path.join(__dirname, '../../uploads/reports');
    await fs.promises.mkdir(reportDirectory, { recursive: true });
    const fileName = `attendance-monthly-${staff.id}-${period.year}-${String(period.month).padStart(2, '0')}.pdf`;
    await generateMonthlyAttendancePdf(path.join(reportDirectory, fileName), {
      staff,
      periodLabel: `${period.monthName} ${period.year}`,
      summary,
      days
    });
    const downloadUrl = makeDownloadUrl(req, fileName);
    const reportPath = `/uploads/reports/${encodeURIComponent(fileName)}`;
    return res.json({
      ReportPath: reportPath,
      DownloadUrl: downloadUrl,
      FileName: fileName,
      ContentType: 'application/pdf',
      Status: 1,
      Message: 'Monthly PDF report generated'
    });
  } catch (err) {
    console.error('downloadReport:', err);
    return res.json({ Status: 0, Message: 'Monthly PDF report generation failed', Exception: err.message });
  }
}

async function downloadDailyReport(req, res) {
  try {
    const staff = await resolveReportStaff(req.body.UserId || req.body.userId);
    if (!staff) return res.json({ Status: 0, Message: 'Staff member not found' });
    const requestedDate = req.body.Date || req.body.date;
    const targetDate = requestedDate || new Date().toISOString().slice(0, 10);
    const parsedDate = new Date(`${targetDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== targetDate) {
      return res.json({ Status: 0, Message: 'Valid Date in YYYY-MM-DD format is required' });
    }

    const period = getReportPeriod({
      Year: Number(targetDate.slice(0, 4)),
      Month: Number(targetDate.slice(5, 7))
    });
    const [calendar, punchesByDate] = await Promise.all([
      getAttendanceCalendar(staff, period),
      loadReportPunches(staff, { ...period, startDate: targetDate, nextDate: new Date(
        new Date(`${targetDate}T00:00:00Z`).getTime() + 86400000
      ).toISOString().slice(0, 10) })
    ]);
    const day = calendar.find(item => item.date === targetDate);
    if (!day) return res.json({ Status: 0, Message: 'Attendance date not found' });
    const punches = punchesByDate.get(targetDate) || [day.checkIn, day.checkOut].filter(Boolean);
    const details = formatPunches(punches);
    const reportDirectory = path.join(__dirname, '../../uploads/reports');
    await fs.promises.mkdir(reportDirectory, { recursive: true });
    const fileName = `attendance-daily-${staff.id}-${targetDate}.pdf`;
    await generateDailyAttendancePdf(path.join(reportDirectory, fileName), {
      staff,
      periodLabel: new Date(`${targetDate}T00:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
      }),
      day: { ...day, status: getStatusLabel(day.status) },
      punches: details.records,
      firstIn: details.records.find(record => record.type === 'Punch in')?.time,
      lastOut: [...details.records].reverse().find(record => record.type === 'Punch out')?.time,
      workingDuration: details.workingDuration
    });
    const downloadUrl = makeDownloadUrl(req, fileName);
    const reportPath = `/uploads/reports/${encodeURIComponent(fileName)}`;
    return res.json({
      ReportPath: reportPath,
      DownloadUrl: downloadUrl,
      FileName: fileName,
      ContentType: 'application/pdf',
      Status: 1,
      Message: 'Daily PDF report generated'
    });
  } catch (err) {
    console.error('downloadDailyReport:', err);
    return res.json({ Status: 0, Message: 'Daily PDF report generation failed', Exception: err.message });
  }
}

// Get Academic Holidays list
async function getHolidayDetails(req, res) {
  try {
    const { Year, year } = req.body || {};
    const targetYear = Number(Year ?? year ?? new Date().getFullYear());
    const orgCode = String(req.orgCode || '').trim();

    if (!orgCode) {
      return res.json({
        Status: 0,
        Message: 'Organization code is required'
      });
    }

    if (!Number.isInteger(targetYear) || targetYear < 1) {
      return res.json({
        Status: 0,
        Message: 'A valid year is required'
      });
    }

    const [organisationRows] = await db.query(
      `SELECT id
       FROM organisations
       WHERE LOWER(code) = LOWER($1)
       LIMIT 1`,
      [orgCode]
    );

    if (organisationRows.length === 0) {
      return res.json({
        Status: 0,
        Message: 'Organization not found'
      });
    }

    const [rows] = await db.query(
      `SELECT
         id,
         org_id,
         cust_id,
         TO_CHAR(COALESCE(holiday_date, date), 'YYYY-MM-DD') AS effective_holiday_date,
         TO_CHAR(COALESCE(holiday_to_date, holiday_date, date), 'YYYY-MM-DD') AS effective_holiday_to_date,
         holiday_desc,
         description,
         name,
         is_range,
         user_id
       FROM holidays
       WHERE org_id = $1
         AND EXTRACT(YEAR FROM COALESCE(holiday_date, date)) = $2
       ORDER BY COALESCE(holiday_date, date) ASC`,
      [organisationRows[0].id, targetYear]
    );

    const holidays = rows.map(r => ({
      HolidayId: r.id,
      CustID: r.org_id || r.cust_id,
      HolidayDate: r.effective_holiday_date,
      HolidayToDate: r.effective_holiday_to_date,
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
  downloadDailyReport,
  getHolidayDetails,
  getLeaveMaster,
  saveContactLeave,
  getContactLeaveBalance,
  getContactLeaveStatus
};
