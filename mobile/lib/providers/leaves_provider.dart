import 'package:flutter/material.dart';
import '../models/leave_model.dart';
import '../services/api_service.dart';

class LeavesProvider extends ChangeNotifier {
  final ApiService _api;

  List<LeaveApplication> _leaves = [];
  String _statusFilter = 'pending'; // 'pending', 'approved', 'rejected', ''
  bool _isLoading = false;
  bool _isProcessing = false;
  String? _errorMessage;
  String? _successMessage;

  LeavesProvider(this._api);

  List<LeaveApplication> get leaves => _leaves;
  String get statusFilter => _statusFilter;
  bool get isLoading => _isLoading;
  bool get isProcessing => _isProcessing;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;

  int get pendingCount => _leaves.where((l) => l.status.toLowerCase() == 'pending').length;

  void setStatusFilter(String filter) {
    _statusFilter = filter;
    fetchLeaves();
  }

  Future<void> fetchLeaves() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.getLeaves(status: _statusFilter.isEmpty ? null : _statusFilter);
      _leaves = res.map((l) => LeaveApplication.fromJson(l as Map<String, dynamic>)).toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateStatus({
    required int leaveId,
    required String newStatus, // 'approved' or 'rejected'
    String? remarks,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      await _api.updateLeaveStatus(
        leaveId: leaveId,
        status: newStatus,
        adminRemarks: remarks ?? 'Processed via Mobile App',
      );
      _successMessage = 'Leave ${newStatus == 'approved' ? 'approved' : 'rejected'} successfully.';
      await fetchLeaves();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to update leave: $e';
      return false;
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }
}

