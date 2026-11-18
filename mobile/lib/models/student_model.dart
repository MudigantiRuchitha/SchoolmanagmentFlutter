class Student {
  final int id;
  final String fullName;
  final String? admissionNo;
  final String? rollNo;
  final int? classId;
  final String? className;
  final String? section;
  final int? branchId;
  final String? branchName;
  final String? gender;
  final String? parentName;
  final String? parentPhone;
  final String? photoUrl;
  final bool? hasFaceRegistered;
  final bool isActive;

  Student({
    required this.id,
    required this.fullName,
    this.admissionNo,
    this.rollNo,
    this.classId,
    this.className,
    this.section,
    this.branchId,
    this.branchName,
    this.gender,
    this.parentName,
    this.parentPhone,
    this.photoUrl,
    this.hasFaceRegistered,
    this.isActive = true,
  });

  factory Student.fromJson(Map<String, dynamic> json) {
    final rawIsActive = json['is_active'];
    return Student(
      id: json['id'] is int
          ? json['id']
          : int.tryParse(json['id'].toString()) ?? 0,
      fullName: json['full_name'] ?? json['name'] ?? 'Unknown Student',
      admissionNo: json['admission_no']?.toString(),
      rollNo: json['roll_no']?.toString() ?? json['roll_number']?.toString(),
      classId: json['class_id'] != null
          ? int.tryParse(json['class_id'].toString())
          : null,
      className: json['class_name'],
      section: json['section'],
      branchId: json['branch_id'] != null
          ? int.tryParse(json['branch_id'].toString())
          : null,
      branchName: json['branch_name'],
      gender: json['gender'],
      parentName: json['parent_name'] ?? json['father_name'],
      parentPhone: json['parent_phone'] ?? json['emergency_contact'],
      photoUrl: json['photo_url'] ?? json['profile_image'],
      hasFaceRegistered:
          json['has_face_registered'] == true ||
          json['face_registered'] == true,
      isActive: rawIsActive == null
          ? json['status']?.toString().toLowerCase() != 'inactive'
          : rawIsActive == true ||
                rawIsActive == 1 ||
                rawIsActive.toString().toLowerCase() == 'true',
    );
  }
}
