class LeaveApplication {
  final int id;
  final int staffId;
  final String staffName;
  final String? designation;
  final String? branchName;
  final String leaveType;
  final String startDate;
  final String endDate;
  final double totalDays;
  final String reason;
  String status; // pending, approved, rejected
  String? adminRemarks;
  final String? createdAt;

  LeaveApplication({
    required this.id,
    required this.staffId,
    required this.staffName,
    this.designation,
    this.branchName,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    required this.status,
    this.adminRemarks,
    this.createdAt,
  });

  factory LeaveApplication.fromJson(Map<String, dynamic> json) {
    return LeaveApplication(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      staffId: int.tryParse(json['staff_id']?.toString() ?? '0') ?? 0,
      staffName: json['staff_name'] ?? json['full_name'] ?? 'Staff',
      designation: json['designation'],
      branchName: json['branch_name'],
      leaveType: json['leave_type'] ?? json['type_name'] ?? 'Leave',
      startDate: json['start_date'] ?? '',
      endDate: json['end_date'] ?? '',
      totalDays: double.tryParse(json['days']?.toString() ?? json['total_days']?.toString() ?? '1') ?? 1.0,
      reason: json['reason'] ?? '',
      status: json['status'] ?? 'pending',
      adminRemarks: json['admin_remarks'],
      createdAt: json['created_at'],
    );
  }
}

