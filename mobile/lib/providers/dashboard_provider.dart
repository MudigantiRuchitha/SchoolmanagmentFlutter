import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/dashboard_stats_model.dart';
import '../models/notice_model.dart';
import '../services/api_service.dart';

class DashboardProvider extends ChangeNotifier {
  final ApiService _api;

  DashboardStats? _stats;
  AttendanceSummary? _studentSummary;
  AttendanceSummary? _staffSummary;
  List<SchoolNotice> _recentNotices = [];
  bool _isLoading = false;
  String? _errorMessage;

  DashboardProvider(this._api);

  DashboardStats? get stats => _stats;
  AttendanceSummary? get studentSummary => _studentSummary;
  AttendanceSummary? get staffSummary => _staffSummary;
  List<SchoolNotice> get recentNotices => _recentNotices;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchDashboardData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    try {
      // 1. Stats
      try {
        final statsRes = await _api.getDashboardStats();
        if (statsRes['success'] == true && statsRes['stats'] != null) {
          _stats = DashboardStats.fromJson(statsRes['stats']);
        }
      } catch (_) {}

      // 2. Student attendance summary today
      try {
        final stuRes = await _api.getTodayAttendance(type: 'student', date: todayStr);
        if (stuRes['summary'] != null) {
          _studentSummary = AttendanceSummary.fromJson(stuRes['summary']);
        }
      } catch (_) {}

      // 3. Staff attendance summary today
      try {
        final stfRes = await _api.getTodayAttendance(type: 'staff', date: todayStr);
        if (stfRes['summary'] != null) {
          _staffSummary = AttendanceSummary.fromJson(stfRes['summary']);
        }
      } catch (_) {}

      // 4. Recent notices
      try {
        final noticesRes = await _api.getRecentNotices();
        _recentNotices = noticesRes.map((n) => SchoolNotice.fromJson(n)).toList();
      } catch (_) {}

    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

