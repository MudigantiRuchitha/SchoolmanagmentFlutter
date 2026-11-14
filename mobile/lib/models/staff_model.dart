class StaffMember {
  final int id;
  final String? staffId;
  final String fullName;
  final String roleType; // teaching, non-teaching, management
  final String? designation;
  final int? branchId;
  final String? branchName;
  final String? phone;
  final String? email;
  final String expectedCheckIn;
  final String expectedCheckOut;
  final String? photoUrl;
  final bool isActive;

  StaffMember({
    required this.id,
    this.staffId,
    required this.fullName,
    required this.roleType,
    this.designation,
    this.branchId,
    this.branchName,
    this.phone,
    this.email,
    required this.expectedCheckIn,
    required this.expectedCheckOut,
    this.photoUrl,
    required this.isActive,
  });

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    return StaffMember(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      staffId: json['staff_id']?.toString(),
      fullName: json['full_name'] ?? 'Staff Member',
      roleType: json['role_type'] ?? 'teaching',
      designation: json['designation'],
      branchId: json['branch_id'] != null ? int.tryParse(json['branch_id'].toString()) : null,
      branchName: json['branch_name'],
      phone: json['phone'],
      email: json['email'],
      expectedCheckIn: json['expected_check_in'] ?? '09:00',
      expectedCheckOut: json['expected_check_out'] ?? '17:00',
      photoUrl: json['photo_url'] ?? json['profile_image'],
      isActive: json['is_active'] != false,
    );
  }
}

