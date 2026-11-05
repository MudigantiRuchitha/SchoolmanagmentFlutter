const { Pool } = require('pg');

/**
 * Returns current local date and time formatted for PostgreSQL.
 */
function getNowDateTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return { dateStr, timeStr };
}

/**
 * Converts HH:MM:SS or HH:MM string to total minutes from midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Checks whether check-in time is strictly after the expected school hour (arrival time) plus grace period (default 15 minutes).
 * Defaults expected check-in to 09:00:00.
 */
function isAfterSchoolHour(checkInTime, expectedCheckIn, graceMinutes = 15) {
  if (!checkInTime) return false;
  const inMins = timeToMinutes(checkInTime);
  const expMins = timeToMinutes(expectedCheckIn || '09:00:00');
  return inMins > (expMins + graceMinutes);
}

/**
 * Records staff check-in when staff logs in.
 * Status is set to 'late' if login time is after staff's expected login hours (expected_check_in) + 15 mins grace period.
 * First check-in of the day is preserved.
 */
async function recordStaffLoginAttendance(dbOrPool, staff, punchTime, punchDate) {
  if (!staff || !staff.id || !staff.org_id) return null;
  const now = getNowDateTime();
  const dateStr = punchDate || now.dateStr;
  const timeStr = punchTime || now.timeStr;
  const expIn = staff.expected_check_in || '09:00:00';
  const isLate = isAfterSchoolHour(timeStr, expIn, 15);
  const status = isLate ? 'late' : 'present';
  const note = isLate
    ? `Checked in late via login (${timeStr})`
    : `Checked in via login (${timeStr})`;

  try {
    // 1. Record punch
    await dbOrPool.query(
      `INSERT INTO staff_attendance_punches (staff_id, org_id, date, punch_time, mode)
       VALUES ($1, $2, $3, $4, 'login')`,
      [staff.id, staff.org_id, dateStr, timeStr]
    );

    // 2. Upsert into staff_attendance
    // Only sets check_in and shift_status if check_in was not already set today
    const res = await dbOrPool.query(
      `INSERT INTO staff_attendance (staff_id, org_id, date, check_in, shift_status, mode, notes)
       VALUES ($1, $2, $3, $4, $5, 'login', $6)
       ON CONFLICT (staff_id, date) DO UPDATE SET
         check_in = COALESCE(staff_attendance.check_in, EXCLUDED.check_in),
         shift_status = CASE
           WHEN staff_attendance.check_in IS NULL THEN EXCLUDED.shift_status
           WHEN staff_attendance.check_in > (COALESCE($7::TIME, '09:00:00'::TIME) + INTERVAL '15 minutes') THEN 'late'
           ELSE staff_attendance.shift_status
         END,
         mode = COALESCE(staff_attendance.mode, EXCLUDED.mode),
         notes = CASE
           WHEN staff_attendance.notes IS NULL THEN EXCLUDED.notes
           ELSE staff_attendance.notes
         END
       RETURNING *`,
      [staff.id, staff.org_id, dateStr, timeStr, status, note, expIn]
    );

    const record = res.rows ? res.rows[0] : (res[0] && res[0][0]);
    console.log(`[attendanceHelper] Recorded check-in for staff ${staff.id} at ${timeStr} (status: ${record?.shift_status || status})`);
    return record;
  } catch (err) {
    console.error(`[attendanceHelper] Failed to record login attendance for staff ${staff.id}:`, err.message);
    return null;
  }
}

/**
 * Records staff check-out when staff logs out.
 */
async function recordStaffLogoutAttendance(dbOrPool, staff, punchTime, punchDate) {
  if (!staff || !staff.id || !staff.org_id) return null;
  const now = getNowDateTime();
  const dateStr = punchDate || now.dateStr;
  const timeStr = punchTime || now.timeStr;
  const note = `Checked out via logout (${timeStr})`;

  try {
    // 1. Record punch
    await dbOrPool.query(
      `INSERT INTO staff_attendance_punches (staff_id, org_id, date, punch_time, mode)
       VALUES ($1, $2, $3, $4, 'logout')`,
      [staff.id, staff.org_id, dateStr, timeStr]
    );

    // 2. Upsert check_out in staff_attendance
    const res = await dbOrPool.query(
      `INSERT INTO staff_attendance (staff_id, org_id, date, check_out, shift_status, mode, notes)
       VALUES ($1, $2, $3, $4, 'present', 'login', $5)
       ON CONFLICT (staff_id, date) DO UPDATE SET
         check_out = EXCLUDED.check_out,
         notes = CASE
           WHEN staff_attendance.notes IS NOT NULL AND NOT staff_attendance.notes LIKE '%Checked out%'
             THEN staff_attendance.notes || ' | ' || EXCLUDED.notes
           ELSE COALESCE(staff_attendance.notes, EXCLUDED.notes)
         END
       RETURNING *`,
      [staff.id, staff.org_id, dateStr, timeStr, note]
    );

    const record = res.rows ? res.rows[0] : (res[0] && res[0][0]);
    console.log(`[attendanceHelper] Recorded check-out for staff ${staff.id} at ${timeStr}`);
    return record;
  } catch (err) {
    console.error(`[attendanceHelper] Failed to record logout attendance for staff ${staff.id}:`, err.message);
    return null;
  }
}

/**
 * Calculates staff attendance status based on check-in, check-out and expected school hours.
 * 
 * Rules:
 * 1. If neither check_in nor check_out exists: status remains manualStatus || null.
 * 2. If check_in is strictly after expectedCheckIn + graceMinutes (default 15m): it is late.
 * 3. Total school hours = expectedCheckOut - expectedCheckIn (default 09:00 to 17:00 = 8 hrs = 480 mins).
 *    Half-day threshold = total school hours / 2 (e.g. 240 mins = 4 hrs).
 * 4. If check_in exists but NO check_out:
 *    - if late: 'late'
 *    - if on time: 'present'
 * 5. If BOTH check_in and check_out exist:
 *    duration = check_out - check_in
 *    - If duration >= halfDayMins:
 *        - if completed full day (duration >= totalSchoolMins - 30):
 *            - if late: 'late'
 *            - if on time: 'present'
 *        - else (stayed at least half day, but less than full day):
 *            - 'half-day'
 *    - If duration < halfDayMins (e.g. stayed 1 minute between 3:44 and 3:45):
 *        - MUST NOT show 'half-day'!
 *        - if late: 'late'
 *        - else: 'absent'
 */
function calculateStaffAttendanceStatus(checkIn, checkOut, expectedCheckIn = '09:00', expectedCheckOut = '17:00', manualStatus = null) {
  if (!checkIn && !checkOut) {
    return manualStatus || null;
  }

  const expInMins = timeToMinutes(expectedCheckIn || '09:00:00');
  const expOutMins = timeToMinutes(expectedCheckOut || '17:00:00');
  const totalSchoolMins = (expOutMins > expInMins) ? (expOutMins - expInMins) : 480;
  const halfDayMins = Math.floor(totalSchoolMins / 2);

  const inMins = timeToMinutes(checkIn);
  const isLate = checkIn ? isAfterSchoolHour(checkIn, expectedCheckIn, 15) : false;

  // Case 1: Only check_in recorded so far
  if (checkIn && !checkOut) {
    if (manualStatus && manualStatus !== 'present' && manualStatus !== 'late') {
      return manualStatus;
    }
    return isLate ? 'late' : 'present';
  }

  // Case 2: Only check_out recorded (anomalous)
  if (!checkIn && checkOut) {
    return manualStatus || 'absent';
  }

  // Case 3: Both check_in and check_out recorded
  const outMins = timeToMinutes(checkOut);
  const durationMins = Math.max(0, outMins - inMins);

  if (durationMins >= halfDayMins) {
    // Stayed for at least half of the total school hours
    if (durationMins >= (totalSchoolMins - 30)) {
      return isLate ? 'late' : 'present';
    }
    return 'half-day';
  } else {
    // Stayed LESS than half of the total school hours (e.g. 1 min from 3:44 to 3:45)
    // Must NOT show half-day!
    if (isLate) {
      return 'late';
    }
    return 'absent';
  }
}

module.exports = {
  getNowDateTime,
  timeToMinutes,
  isAfterSchoolHour,
  calculateStaffAttendanceStatus,
  recordStaffLoginAttendance,
  recordStaffLogoutAttendance
};
