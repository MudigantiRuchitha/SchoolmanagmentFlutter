const db = require('../config/db');
const { verifyToken } = require('../utils/jwt');

// Get teacher's classes (standard REST)
async function getClasses(req, res) {
  const teacherId = req.params.teacherId;
  try {
    const [staffRows] = await db.query(
      `SELECT id, staff_id FROM staff 
       WHERE (id::text = $1::text OR staff_id = $1::text OR LOWER(username) = LOWER($1::text))
         AND (is_deleted IS NOT TRUE)`,
      [String(teacherId)]
    );

    let matchingDbIds = staffRows.map(s => s.id);
    let matchingStaffIds = staffRows.map(s => s.staff_id).filter(Boolean);

    const [rows] = await db.query(
      `SELECT DISTINCT c.* 
       FROM classes c
       LEFT JOIN staff s ON (s.id = c.teacher_id OR s.id = ANY(c.teacher_ids))
       WHERE (c.is_active = true OR c.is_active IS NULL)
         AND (c.is_deleted IS NOT TRUE)
         AND (
           c.teacher_id = ANY($1::int[])
           OR c.teacher_id::text = ANY($2::text[])
           OR s.id = ANY($1::int[])
           OR s.staff_id = ANY($2::text[])
         )`,
      [
        matchingDbIds.length > 0 ? matchingDbIds : [-1],
        matchingStaffIds.length > 0 ? matchingStaffIds : [String(teacherId)]
      ]
    );

    const classes = rows.map(c => ({
      classId: c.id,
      className: c.class_name || c.name,
      grade: c.grade,
      section: c.section,
      subject: c.subject,
      studentCount: c.student_count
    }));

    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Get teacher's timetable periods (device REST)
async function getTeacherPeriods(req, res) {
  const teacherId = String(req.params.teacherId);
  const classId = req.params.classId ? parseInt(req.params.classId, 10) : null;

  if (req.params.classId && Number.isNaN(classId)) {
    return res.status(400).json({ success: false, message: 'Invalid class ID.' });
  }

  try {
    const [staffRows] = await db.query(
      `SELECT id, staff_id, org_id, username
       FROM staff
       WHERE (id::text = $1::text
          OR staff_id = $1::text
          OR LOWER(username) = LOWER($1::text))
          AND (is_deleted IS NOT TRUE)
       LIMIT 1`,
      [teacherId]
    );

    if (staffRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    const teacher = staffRows[0];
    const [periodRows] = await db.query(
      `SELECT DISTINCT t.id,
              t.class_id AS "classId",
              CASE
                WHEN t.slot_type = 'period' THEN 'Period ' || t.slot_number::text
                ELSE t.slot_name
              END AS "slotName",
              t.slot_type AS "slotType",
              t.slot_number AS "slotNumber",
              t.subject_name AS "subjectName",
              t.start_time AS "startTime",
              t.end_time AS "endTime"
       FROM timetable_slots t
       WHERE t.org_id = $1
         AND t.teacher_id = $2
         AND ($3::int IS NULL OR t.class_id = $3)
         AND (t.is_active = true OR t.is_active IS NULL)
       ORDER BY t.slot_number, t.start_time`,
      [teacher.org_id, teacher.id, classId]
    );

    let periods = periodRows;
    if (periods.length === 0) {
      const [defaultRows] = await db.query(
        `SELECT DISTINCT id,
                NULL AS "classId",
                CASE
                  WHEN slot_type = 'period' THEN 'Period ' || slot_number::text
                  ELSE slot_name
                END AS "slotName",
                slot_type AS "slotType",
                slot_number AS "slotNumber",
                subject_name AS "subjectName",
                start_time AS "startTime",
                end_time AS "endTime"
         FROM timetable_slots
         WHERE org_id = $1
           AND class_id IS NULL
           AND (is_active = true OR is_active IS NULL)
         ORDER BY slot_number, start_time`,
        [teacher.org_id]
      );
      periods = defaultRows;
    }

    res.json(periods);
  } catch (err) {
    console.error('Error fetching teacher periods:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Get teacher's classes (device REST)
async function getDeviceUserClasses(req, res) {
  let UserId = req.query?.UserId || req.query?.userId || req.body?.UserId || req.body?.userId || req.user?.id || req.user?.username;

  // 1. Decode JWT token if passed in body.TokenId or headers
  const token = req.body?.TokenId || req.body?.token || (req.headers?.authorization && req.headers.authorization.split(' ')[1]);
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded && (decoded.id || decoded.username)) {
        UserId = decoded.id || decoded.username;
      }
    } catch (e) {
      // Ignore token decode error
    }
  }

  console.log('getDeviceUserClasses request - URL:', req.originalUrl, 'UserId:', UserId, 'query:', req.query, 'body:', req.body);

  try {
    let rows = [];

    if (UserId) {
      const padded1 = String(UserId).padStart(2, '0');
      const padded2 = String(UserId).padStart(3, '0');

      // Resolve staff member matching DB id, staff_id, or username
      const [staffRows] = await db.query(
        `SELECT id, staff_id, org_id, username FROM staff 
         WHERE staff_id = $1::text OR staff_id = $2::text OR staff_id = $3::text OR LOWER(username) = LOWER($1::text) OR id::text = $1::text
         ORDER BY CASE 
           WHEN staff_id = $1::text THEN 1 
           WHEN staff_id = $2::text THEN 2 
           WHEN staff_id = $3::text THEN 3 
           WHEN LOWER(username) = LOWER($1::text) THEN 4 
           WHEN id::text = $1::text THEN 5 
           ELSE 6 
         END`,
        [String(UserId), padded1, padded2]
      );

      const matchingDbIds = staffRows.map(s => s.id);
      if (parseInt(UserId) && !isNaN(parseInt(UserId))) {
        matchingDbIds.push(parseInt(UserId));
      }
      const matchingStaffIds = staffRows.map(s => s.staff_id).filter(Boolean);
      matchingStaffIds.push(String(UserId));
      matchingStaffIds.push(padded1);

      const matchingUsernames = staffRows.map(s => s.username).filter(Boolean);
      matchingUsernames.push(String(UserId).toLowerCase());

      // Query classes matching any of the teacher identifiers with student_count
      const [classQueryRows] = await db.query(
        `SELECT DISTINCT c.*, b.name as branch_name,
           (SELECT COUNT(*) FROM students st WHERE (st.class_id = c.id OR st.class_id::text = c.id::text) AND (st.is_active = true OR st.is_active IS NULL) AND (st.is_deleted IS NOT TRUE)) as student_count
         FROM classes c
         LEFT JOIN branches b ON b.id = c.branch_id
         LEFT JOIN staff s ON (s.id = c.teacher_id OR s.id = ANY(c.teacher_ids))
         WHERE (c.is_active = true OR c.is_active IS NULL)
           AND (c.is_deleted IS NOT TRUE)
           AND (
             c.teacher_id = ANY($1::int[])
             OR c.teacher_id::text = ANY($2::text[])
             OR s.id = ANY($1::int[])
             OR s.staff_id = ANY($2::text[])
             OR LOWER(s.username) = ANY($3::text[])
           )`,
        [
          matchingDbIds.length > 0 ? matchingDbIds : [-1],
          matchingStaffIds.length > 0 ? matchingStaffIds : [String(UserId)],
          matchingUsernames.length > 0 ? matchingUsernames.map(u => u.toLowerCase()) : [String(UserId).toLowerCase()]
        ]
      );
      rows = classQueryRows;
    }

    if (!rows || rows.length === 0) {
      // Fallback: Query all active classes with student_count
      const [allClasses] = await db.query(
        `SELECT c.*, b.name as branch_name,
           (SELECT COUNT(*) FROM students st WHERE (st.class_id = c.id OR st.class_id::text = c.id::text) AND (st.is_active = true OR st.is_active IS NULL) AND (st.is_deleted IS NOT TRUE)) as student_count
         FROM classes c
         LEFT JOIN branches b ON b.id = c.branch_id
         WHERE (c.is_active = true OR c.is_active IS NULL)
           AND (c.is_deleted IS NOT TRUE)
         ORDER BY c.name`
      );
      rows = allClasses;
    }

    // Format classes for mobile attendance device with dynamic AttendanceMode & TimetableSlots
    const classes = await Promise.all(rows.map(async c => {
      const sCount = parseInt(c.student_count) || 0;
      const cName = (c.class_name || c.name || '') + (c.section ? ` (${c.section})` : '');

      let attMode = 'MORNING_EVENING';
      let slotRows = [];

      try {
        const [settingRows] = await db.query(
          'SELECT attendance_mode FROM class_attendance_settings WHERE class_id = $1 LIMIT 1',
          [c.id]
        );
        if (settingRows.length > 0) attMode = settingRows[0].attendance_mode;

        const [sRows] = await db.query(
          'SELECT * FROM timetable_slots WHERE class_id = $1 AND (is_active = true OR is_active IS NULL) ORDER BY slot_number, start_time',
          [c.id]
        );
        slotRows = sRows || [];

        if (slotRows.length === 0 && attMode === 'MORNING_EVENING') {
          const [orgSlots] = await db.query(
            'SELECT * FROM timetable_slots WHERE class_id IS NULL AND (is_active = true OR is_active IS NULL) ORDER BY slot_number',
            []
          );
          if (orgSlots.length > 0) slotRows = orgSlots;
        }
      } catch (err) {
        // Fallback default if table initializing
      }

      let formattedSlots = slotRows.map(s => ({
        timetableSlotId: s.id,
        slotId: s.id,
        Id: s.id,
        id: s.id,
        slotType: s.slot_type,
        slotNumber: s.slot_number,
        slotName: s.slot_name,
        name: s.slot_name,
        Name: s.slot_name,
        subjectName: s.subject_name || '',
        SubjectName: s.subject_name || '',
        startTime: s.start_time,
        endTime: s.end_time,
        teacherId: s.teacher_id,
        isActive: s.is_active
      }));

      if (formattedSlots.length === 0) {
        if (attMode === 'MORNING_EVENING') {
          formattedSlots = [
            { timetableSlotId: 1, slotId: 1, Id: 1, slotType: 'morning', slotNumber: 1, slotName: 'Morning (AM)', name: 'Morning (AM)', Name: 'Morning (AM)', startTime: '09:00:00', endTime: '09:30:00' },
            { timetableSlotId: 2, slotId: 2, Id: 2, slotType: 'evening', slotNumber: 2, slotName: 'Evening (PM)', name: 'Evening (PM)', Name: 'Evening (PM)', startTime: '15:30:00', endTime: '16:00:00' }
          ];
        } else {
          formattedSlots = [
            { timetableSlotId: 1, slotId: 1, Id: 1, slotType: 'period', slotNumber: 1, slotName: 'Period 1', name: 'Period 1', Name: 'Period 1', subjectName: 'Mathematics', startTime: '09:00:00', endTime: '09:45:00' },
            { timetableSlotId: 2, slotId: 2, Id: 2, slotType: 'period', slotNumber: 2, slotName: 'Period 2', name: 'Period 2', Name: 'Period 2', subjectName: 'Physics', startTime: '09:45:00', endTime: '10:30:00' },
            { timetableSlotId: 3, slotId: 3, Id: 3, slotType: 'period', slotNumber: 3, slotName: 'Period 3', name: 'Period 3', Name: 'Period 3', subjectName: 'Chemistry', startTime: '10:45:00', endTime: '11:30:00' }
          ];
        }
      }

      return {
        id: c.id,
        Id: c.id,
        GroupId: c.id,
        groupId: c.id,
        GroupName: c.class_name || c.name,
        groupName: c.class_name || c.name,
        ClassId: c.id,
        classId: c.id,
        ClassName: cName,
        className: cName,
        name: cName,
        Name: cName,
        Section: c.section || '',
        section: c.section || '',
        StudentCount: sCount,
        studentCount: sCount,
        StudentsCount: sCount,
        studentsCount: sCount,
        TotalStudents: sCount,
        totalStudents: sCount,
        TotalStudentCount: sCount,
        totalStudentCount: sCount,
        Count: sCount,
        count: sCount,
        TeacherId: UserId || c.teacher_id,
        teacherId: UserId || c.teacher_id,
        AttendanceMode: attMode,
        attendanceMode: attMode,
        Mode: attMode,
        mode: attMode,
        TimetableSlots: formattedSlots,
        timetableSlots: formattedSlots,
        Slots: formattedSlots,
        slots: formattedSlots
      };
    }));

    console.log(`[getDeviceUserClasses] Found ${classes.length} classes for UserId "${UserId}":`, classes.map(c => `${c.ClassName} (${c.StudentCount} students)`));

    res.json({
      objUserClassInfo: classes,
      objUserClassInfoList: classes,
      objClassesInfo: classes,
      objUserClasses: classes,
      objUserGroupInfo: classes,
      objUserGroupInfoList: classes,
      ClassList: classes,
      classList: classes,
      classes: classes,
      data: classes,
      Status: 1,
      Message: 'Classes fetched successfully',
      Exception: null
    });
  } catch (err) {
    console.error('getDeviceUserClasses error:', err);
    res.json({ Status: 0, Message: 'Failed to fetch classes', Exception: err.message });
  }
}

module.exports = {
  getClasses,
  getTeacherPeriods,
  getDeviceUserClasses
};
