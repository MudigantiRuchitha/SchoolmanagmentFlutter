import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/attendance_model.dart';
import '../models/dashboard_stats_model.dart';
import '../services/api_service.dart';

class AttendanceProvider extends ChangeNotifier {
  final ApiService _api;

  // Student Attendance
  List<StudentAttendanceRecord> _studentRecords = [];
  AttendanceSummary? _studentSummary;
  DateTime _selectedDate = DateTime.now();
  int? _selectedClassId;
  int? _selectedBranchId;
  String? _selectedPeriod;

  // Staff Attendance
  List<StaffAttendanceRecord> _staffRecords = [];
  AttendanceSummary? _staffSummary;
  String? _selectedRoleType;

  // State
  bool _isLoading = false;
  bool _isSaving = false;
  String? _errorMessage;
  String? _successMessage;

  // Tracks unsaved changes locally: studentId -> status
  final Map<int, String> _studentStatusChanges = {};
  // Tracks unsaved changes locally: staffId -> status
  final Map<int, String> _staffStatusChanges = {};

  AttendanceProvider(this._api);

  List<StudentAttendanceRecord> get studentRecords => _studentRecords;
  AttendanceSummary? get studentSummary => _studentSummary;
  DateTime get selectedDate => _selectedDate;
  int? get selectedClassId => _selectedClassId;
  int? get selectedBranchId => _selectedBranchId;
  String? get selectedPeriod => _selectedPeriod;

  List<StaffAttendanceRecord> get staffRecords => _staffRecords;
  AttendanceSummary? get staffSummary => _staffSummary;
  String? get selectedRoleType => _selectedRoleType;

  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;
  bool get hasUnsavedStudentChanges => _studentStatusChanges.isNotEmpty;
  bool get hasUnsavedStaffChanges => _staffStatusChanges.isNotEmpty;

  String get formattedSelectedDate => DateFormat('yyyy-MM-dd').format(_selectedDate);

  void setDate(DateTime date) {
    _selectedDate = date;
    fetchStudentAttendance();
    fetchStaffAttendance();
  }

  void setClassFilter(int? classId) {
    _selectedClassId = classId;
    fetchStudentAttendance();
  }

  void setBranchFilter(int? branchId) {
    _selectedBranchId = branchId;
    fetchStudentAttendance();
    fetchStaffAttendance();
  }

  void setPeriodFilter(String? period) {
    _selectedPeriod = period;
    fetchStudentAttendance();
  }

  void setRoleFilter(String? role) {
    _selectedRoleType = role;
    fetchStaffAttendance();
  }

  // ----------------- Student Attendance -----------------

  Future<void> fetchStudentAttendance() async {
    _isLoading = true;
    _errorMessage = null;
    _studentStatusChanges.clear();
    notifyListeners();

    try {
      final res = await _api.getStudentAttendance(
        date: formattedSelectedDate,
        classId: _selectedClassId,
        branchId: _selectedBranchId,
        period: _selectedPeriod,
      );

      if (res['records'] is List) {
        _studentRecords = (res['records'] as List)
            .map((r) => StudentAttendanceRecord.fromJson(r as Map<String, dynamic>))
            .toList();
      } else {
        _studentRecords = [];
      }

      if (res['summary'] != null) {
        _studentSummary = AttendanceSummary.fromJson(res['summary']);
      }
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  String getStudentStatus(StudentAttendanceRecord student) {
    return _studentStatusChanges[student.id] ?? student.status ?? '';
  }

  void updateStudentStatus(int studentId, String status) {
    _studentStatusChanges[studentId] = status;
    notifyListeners();
  }

  void markAllStudents(String status) {
    for (var s in _studentRecords) {
      _studentStatusChanges[s.id] = status;
    }
    notifyListeners();
  }

  void clearAllStudentStatuses() {
    for (var s in _studentRecords) {
      _studentStatusChanges[s.id] = '';
    }
    notifyListeners();
  }

  Future<bool> saveStudentAttendance() async {
    if (_studentRecords.isEmpty) return false;
    _isSaving = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      final recordsToSave = _studentRecords.map((s) {
        final currentStatus = _studentStatusChanges[s.id] ?? s.status ?? '';
        return {
          'studentId': s.id,
          'date': formattedSelectedDate,
          'status': currentStatus,
          'checkIn': s.checkIn,
          'checkOut': s.checkOut,
          'mode': 'mobile',
        };
      }).toList();

      await _api.saveStudentAttendance(recordsToSave);
      _successMessage = 'Student attendance saved successfully!';
      _studentStatusChanges.clear();
      await fetchStudentAttendance();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to save attendance: $e';
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  // ----------------- Staff Attendance -----------------

  Future<void> fetchStaffAttendance() async {
    _isLoading = true;
    _errorMessage = null;
    _staffStatusChanges.clear();
    notifyListeners();

    try {
      final res = await _api.getStaffAttendance(
        date: formattedSelectedDate,
        branchId: _selectedBranchId,
        roleType: _selectedRoleType,
      );

      if (res['records'] is List) {
        _staffRecords = (res['records'] as List)
            .map((r) => StaffAttendanceRecord.fromJson(r as Map<String, dynamic>))
            .toList();
      } else {
        _staffRecords = [];
      }

      if (res['summary'] != null) {
        _staffSummary = AttendanceSummary.fromJson(res['summary']);
      }
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  String getStaffStatus(StaffAttendanceRecord staff) {
    return _staffStatusChanges[staff.id] ?? staff.status ?? '';
  }

  void updateStaffStatus(int staffId, String status) {
    _staffStatusChanges[staffId] = status;
    notifyListeners();
  }

  void markAllStaff(String status) {
    for (var s in _staffRecords) {
      _staffStatusChanges[s.id] = status;
    }
    notifyListeners();
  }

  Future<bool> saveStaffAttendance() async {
    if (_staffRecords.isEmpty) return false;
    _isSaving = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      final recordsToSave = _staffRecords.map((s) {
        final currentStatus = _staffStatusChanges[s.id] ?? s.status ?? '';
        return {
          'staffId': s.id,
          'date': formattedSelectedDate,
          'status': currentStatus,
          'checkIn': s.checkIn,
          'checkOut': s.checkOut,
          'mode': 'mobile',
        };
      }).toList();

      await _api.saveStaffAttendance(recordsToSave);
      _successMessage = 'Staff attendance saved successfully!';
      _staffStatusChanges.clear();
      await fetchStaffAttendance();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to save staff attendance: $e';
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  // ----------------- Face Recognition Camera Punch -----------------

  Future<bool> submitFacePunch({
    required String studentOrStaffId,
    required double confidence,
    String? photoUrl,
    required String adminUsername,
  }) async {
    try {
      final nowTime = DateFormat('HH:mm:ss').format(DateTime.now());
      final punch = {
        'StudentId': studentOrStaffId,
        'punch_time': nowTime,
        'Confidence': confidence,
        'PhotoUrl': photoUrl,
      };

      await _api.submitBulkAttendancePunch(
        punches: [punch],
        userId: adminUsername,
      );

      // Refresh both to reflect immediate changes
      fetchStudentAttendance();
      fetchStaffAttendance();
      return true;
    } catch (e) {
      _errorMessage = 'Face punch sync failed: $e';
      notifyListeners();
      return false;
    }
  }
}

