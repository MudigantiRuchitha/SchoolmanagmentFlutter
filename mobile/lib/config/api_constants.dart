class ApiConstants {
  // Default development URL set to the host machine's Wi-Fi IP address.
  // Can be dynamically changed by the user in the app settings/login screen.
  static const String defaultBaseUrl = 'http://192.168.50.136:5000/api';
  static const String defaultEmulatorUrl = 'http://10.0.2.2:5000/api';

  // 1. Auth endpoints
  static const String login = '/auth/login';
  static const String me = '/auth/me';
  static const String logout = '/auth/logout';
  static const String changePassword = '/auth/change-password';

  // 2. Dashboard endpoints
  static const String dashboardStats = '/dashboard/stats';
  static const String dashboardAttendanceToday = '/dashboard/attendance-today';
  static const String dashboardRecentNotices = '/dashboard/recent-notices';

  // 3. Branches & Branch Groups
  static const String branches = '/branches';
  static const String branchGroups = '/branch-groups';

  // 4. Admin Users
  static const String admins = '/admins';

  // 5. Settings
  static const String settings = '/settings';

  // 6. Academic Administrator (Academic Data)
  static const String academicYears = '/academic-data/years';
  static const String academicClasses = '/academic-data/classes';
  static const String academicStudents = '/academic-data/students';
  static const String academicStaff = '/academic-data/staff';

  // 7. Academic Groups
  static const String academicGroups = '/academic-groups';

  // 8. Classes
  static const String classes = '/classes';

  // 9. Staff
  static const String staff = '/staff';

  // 10. Students
  static const String students = '/students';

  // 11. Timetable Setup
  static const String orgDefaultTimetable = '/timetable/org-default';
  static const String classAttendanceSettings = '/timetable/settings';
  static const String timetablePeriods = '/timetable/periods';

  // 12. Student Attendance
  static const String studentAttendance = '/attendance/students';
  static const String submitAttendanceSession = '/attendance/submit';
  static const String bulkDeviceAttendance = '/Device/BulkAttendanceMark';

  // 13. Staff Attendance
  static const String staffAttendance = '/attendance/staff';

  // 14. Leaves
  static const String leaves = '/leaves';
  static const String leaveTypes = '/leaves/types';

  // 15. Holidays
  static const String holidays = '/holidays';

  // 16. Notices
  static const String notices = '/notices';
}
