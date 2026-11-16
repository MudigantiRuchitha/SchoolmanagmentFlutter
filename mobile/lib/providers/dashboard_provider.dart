import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/dashboard_stats_model.dart';
import '../models/notice_model.dart';
import '../services/api_service.dart';

class DashboardProvider extends ChangeNotifier {
  final ApiService _api;

  DashboardStats? _stats;
  List<dynamic> _branches = [];
  List<dynamic> _classes = [];
  List<dynamic> _attendanceRecords = [];
  AttendanceSummary? _attendanceSummary;
  AttendanceSummary? _studentSummary;
  AttendanceSummary? _staffSummary;
  List<SchoolNotice> _recentNotices = [];
  bool _isLoading = false;
  bool _isAttendanceLoading = false;
  String? _errorMessage;

  // Filters
  String _attType = 'student'; // 'student' or 'staff'
  DateTime _selectedDate = DateTime.now();
  String? _selectedBranchId;
  String? _selectedClassId;
  String _searchTerm = '';

  DashboardProvider(this._api);

  DashboardStats? get stats => _stats;
  List<dynamic> get branches => _branches;
  List<dynamic> get classes => _classes;
  List<dynamic> get attendanceRecords => _attendanceRecords;
  AttendanceSummary? get attendanceSummary => _attendanceSummary;
  AttendanceSummary? get studentSummary => _studentSummary ?? _attendanceSummary;
  AttendanceSummary? get staffSummary => _staffSummary ?? _attendanceSummary;
  List<SchoolNotice> get recentNotices => _recentNotices;
  bool get isLoading => _isLoading;
  bool get isAttendanceLoading => _isAttendanceLoading;
  String? get errorMessage => _errorMessage;

  String get attType => _attType;
  DateTime get selectedDate => _selectedDate;
  String? get selectedBranchId => _selectedBranchId;
  String? get selectedClassId => _selectedClassId;
  String get searchTerm => _searchTerm;

  List<dynamic> get filteredRecords {
    if (_searchTerm.trim().isEmpty) {
      return _attendanceRecords;
    }
    final q = _searchTerm.toLowerCase().trim();
    return _attendanceRecords.where((record) {
      if (record is! Map) return false;
      final name = (record['full_name'] ?? '').toString().toLowerCase();
      final admNo = (record['admission_no'] ?? '').toString().toLowerCase();
      final staffId = (record['staff_id'] ?? '').toString().toLowerCase();
      final className = (record['class_name'] ?? '').toString().toLowerCase();
      final roleType = (record['role_type'] ?? '').toString().toLowerCase();
      final designation = (record['designation'] ?? '').toString().toLowerCase();
      final branch = (record['branch_name'] ?? '').toString().toLowerCase();

      return name.contains(q) ||
          admNo.contains(q) ||
          staffId.contains(q) ||
          className.contains(q) ||
          roleType.contains(q) ||
          designation.contains(q) ||
          branch.contains(q);
    }).toList();
  }

  Future<void> fetchDashboardData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Stats
      try {
        final statsRes = await _api.getDashboardStats();
        if (statsRes['success'] == true && statsRes['stats'] != null) {
          _stats = DashboardStats.fromJson(statsRes['stats']);
        }
      } catch (e) {
        debugPrint('Stats error: $e');
      }

      // 2. Branches
      try {
        final branchesList = await _api.getBranches();
        _branches = branchesList;
      } catch (e) {
        debugPrint('Branches error: $e');
      }

      // 3. Recent notices
      try {
        final noticesRes = await _api.getRecentNotices();
        _recentNotices = noticesRes.map((n) => SchoolNotice.fromJson(n)).toList();
      } catch (e) {
        debugPrint('Notices error: $e');
      }

      // 4. Initial attendance data
      await fetchAttendance(isInitial: true);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAttendance({bool isInitial = false}) async {
    _isAttendanceLoading = true;
    if (!isInitial) notifyListeners();

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

    try {
      final res = await _api.getTodayAttendance(
        type: _attType,
        date: dateStr,
        branchId: _selectedBranchId,
        classId: _selectedClassId,
      );

      if (res['records'] != null && res['records'] is List) {
        _attendanceRecords = List<dynamic>.from(res['records']);
      } else {
        _attendanceRecords = [];
      }

      if (res['summary'] != null && res['summary'] is Map) {
        _attendanceSummary = AttendanceSummary.fromJson(
          Map<String, dynamic>.from(res['summary']),
        );
        if (_attType == 'student') {
          _studentSummary = _attendanceSummary;
        } else {
          _staffSummary = _attendanceSummary;
        }
      }
    } catch (e) {
      debugPrint('Fetch attendance error: $e');
    } finally {
      _isAttendanceLoading = false;
      notifyListeners();
    }
  }

  void setAttType(String type) {
    if (_attType == type) return;
    _attType = type;
    _selectedClassId = null;
    fetchAttendance();
  }

  void setSelectedDate(DateTime date) {
    _selectedDate = date;
    fetchAttendance();
  }

  Future<void> setSelectedBranch(String? branchId) async {
    _selectedBranchId = branchId;
    _selectedClassId = null;

    if (branchId != null && branchId.isNotEmpty) {
      try {
        _classes = await _api.getClasses({'branch_id': branchId});
      } catch (_) {
        _classes = [];
      }
    } else {
      _classes = [];
    }

    fetchAttendance();
  }

  void setSelectedClass(String? classId) {
    _selectedClassId = classId;
    fetchAttendance();
  }

  void setSearchTerm(String term) {
    _searchTerm = term;
    notifyListeners();
  }
}
