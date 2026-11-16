class DashboardStats {
  final int totalStudents;
  final int teachingStaff;
  final int nonTeachingStaff;
  final int managementStaff;
  final int totalStaff;
  final int totalAdmins;
  final int totalClasses;
  final int totalBranches;

  DashboardStats({
    required this.totalStudents,
    required this.teachingStaff,
    required this.nonTeachingStaff,
    required this.managementStaff,
    required this.totalStaff,
    required this.totalAdmins,
    required this.totalClasses,
    required this.totalBranches,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalStudents: int.tryParse((json['total_students'] ?? json['totalStudents'])?.toString() ?? '0') ?? 0,
      teachingStaff: int.tryParse((json['teaching_staff'] ?? json['teachingStaff'])?.toString() ?? '0') ?? 0,
      nonTeachingStaff: int.tryParse((json['non_teaching_staff'] ?? json['nonTeachingStaff'])?.toString() ?? '0') ?? 0,
      managementStaff: int.tryParse((json['management_staff'] ?? json['managementStaff'])?.toString() ?? '0') ?? 0,
      totalStaff: int.tryParse((json['total_staff'] ?? json['totalStaff'])?.toString() ?? '0') ?? 0,
      totalAdmins: int.tryParse((json['total_admins'] ?? json['totalAdmins'])?.toString() ?? '0') ?? 0,
      totalClasses: int.tryParse((json['total_classes'] ?? json['totalClasses'])?.toString() ?? '0') ?? 0,
      totalBranches: int.tryParse((json['total_branches'] ?? json['totalBranches'])?.toString() ?? '0') ?? 0,
    );
  }
}

class AttendanceSummary {
  final int total;
  final int present;
  final int absent;
  final int late;
  final int halfDay;

  AttendanceSummary({
    required this.total,
    required this.present,
    required this.absent,
    required this.late,
    required this.halfDay,
  });

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    return AttendanceSummary(
      total: int.tryParse(json['total']?.toString() ?? '0') ?? 0,
      present: int.tryParse(json['present']?.toString() ?? '0') ?? 0,
      absent: int.tryParse(json['absent']?.toString() ?? '0') ?? 0,
      late: int.tryParse(json['late']?.toString() ?? '0') ?? 0,
      halfDay: int.tryParse(json['halfDay']?.toString() ?? '0') ?? 0,
    );
  }

  double get presentPercent => total > 0 ? (present / total) * 100 : 0.0;
  double get absentPercent => total > 0 ? (absent / total) * 100 : 0.0;
  double get latePercent => total > 0 ? (late / total) * 100 : 0.0;
  double get halfDayPercent => total > 0 ? (halfDay / total) * 100 : 0.0;
}
