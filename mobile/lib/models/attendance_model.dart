class StudentAttendanceRecord {
  final int id;
  final String fullName;
  final String? admissionNo;
  final String? rollNo;
  final String? className;
  final String? section;
  final String? branchName;
  final String? checkIn;
  final String? checkOut;
  String? status; // present, absent, late, half-day
  final String? mode;
  final String? notes;
  final String? photoUrl;

  StudentAttendanceRecord({
    required this.id,
    required this.fullName,
    this.admissionNo,
    this.rollNo,
    this.className,
    this.section,
    this.branchName,
    this.checkIn,
    this.checkOut,
    this.status,
    this.mode,
    this.notes,
    this.photoUrl,
  });

  factory StudentAttendanceRecord.fromJson(Map<String, dynamic> json) {
    return StudentAttendanceRecord(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      fullName: json['full_name'] ?? json['fullName'] ?? 'Unknown Student',
      admissionNo: json['admission_no']?.toString(),
      rollNo: json['roll_no']?.toString(),
      className: json['class_name'],
      section: json['section'],
      branchName: json['branch_name'],
      checkIn: json['check_in'],
      checkOut: json['check_out'],
      status: json['status'],
      mode: json['mode'],
      notes: json['notes'],
      photoUrl: json['photo_url'] ?? json['profile_image'],
    );
  }
}

class PunchLog {
  final String time;
  final String? mode;

  PunchLog({required this.time, this.mode});

  factory PunchLog.fromJson(Map<String, dynamic> json) {
    return PunchLog(
      time: json['time'] ?? '',
      mode: json['mode'],
    );
  }
}

class StaffAttendanceRecord {
  final int id;
  final String fullName;
  final String? staffId;
  final String roleType;
  final String? designation;
  final String? branchName;
  final String expectedCheckIn;
  final String expectedCheckOut;
  final String? checkIn;
  final String? checkOut;
  String? status; // present, absent, late, half-day
  final String? photoUrl;
  final List<PunchLog> punches;

  StaffAttendanceRecord({
    required this.id,
    required this.fullName,
    this.staffId,
    required this.roleType,
    this.designation,
    this.branchName,
    required this.expectedCheckIn,
    required this.expectedCheckOut,
    this.checkIn,
    this.checkOut,
    this.status,
    this.photoUrl,
    required this.punches,
  });

  factory StaffAttendanceRecord.fromJson(Map<String, dynamic> json) {
    var rawPunches = json['punches'];
    List<PunchLog> punchList = [];
    if (rawPunches is List) {
      punchList = rawPunches.map((p) => PunchLog.fromJson(p as Map<String, dynamic>)).toList();
    }

    return StaffAttendanceRecord(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      fullName: json['full_name'] ?? 'Staff Member',
      staffId: json['staff_id']?.toString(),
      roleType: json['role_type'] ?? 'teaching',
      designation: json['designation'],
      branchName: json['branch_name'],
      expectedCheckIn: json['expected_check_in'] ?? '09:00',
      expectedCheckOut: json['expected_check_out'] ?? '17:00',
      checkIn: json['check_in'],
      checkOut: json['check_out'],
      status: json['status'],
      photoUrl: json['photo_url'] ?? json['profile_image'],
      punches: punchList,
    );
  }
}

