class User {
  final int id;
  final int? staffId;
  final String username;
  final String? fullName;
  final String? email;
  final String role;
  final String branchAccess;

  User({
    required this.id,
    this.staffId,
    required this.username,
    this.fullName,
    this.email,
    required this.role,
    required this.branchAccess,
  });

  String get name => (fullName != null && fullName!.isNotEmpty) ? fullName! : username;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      staffId: json['staffId'] != null ? int.tryParse(json['staffId'].toString()) : null,
      username: json['username'] ?? '',
      fullName: json['fullName'] ?? json['full_name'],
      email: json['email'],
      role: json['role'] ?? 'admin',
      branchAccess: json['branchAccess'] ?? json['branch_access'] ?? 'all',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'staffId': staffId,
    'username': username,
    'fullName': fullName,
    'email': email,
    'role': role,
    'branchAccess': branchAccess,
  };
}

class Organisation {
  final int id;
  final String name;
  final String code;
  final String? logoUrl;
  final bool timetableAccess;
  final String allowedAttendanceMode;

  Organisation({
    required this.id,
    required this.name,
    required this.code,
    this.logoUrl,
    required this.timetableAccess,
    required this.allowedAttendanceMode,
  });

  factory Organisation.fromJson(Map<String, dynamic> json) {
    return Organisation(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      logoUrl: json['logoUrl'] ?? json['logo_url'],
      timetableAccess: json['timetable_access'] ?? true,
      allowedAttendanceMode: json['allowed_attendance_mode'] ?? 'BOTH',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'logoUrl': logoUrl,
    'timetable_access': timetableAccess,
    'allowed_attendance_mode': allowedAttendanceMode,
  };
}
