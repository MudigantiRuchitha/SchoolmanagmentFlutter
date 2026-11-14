import 'package:flutter/material.dart';
import '../models/staff_model.dart';
import '../services/api_service.dart';

class StaffProvider extends ChangeNotifier {
  final ApiService _api;

  List<StaffMember> _staff = [];
  String _searchQuery = '';
  String? _selectedRoleType;
  int? _selectedBranchId;
  bool _isLoading = false;
  String? _errorMessage;

  StaffProvider(this._api);

  List<StaffMember> get staff => _staff;
  String get searchQuery => _searchQuery;
  String? get selectedRoleType => _selectedRoleType;
  int? get selectedBranchId => _selectedBranchId;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void setSearch(String query) {
    _searchQuery = query;
    fetchStaff();
  }

  void setRoleType(String? role) {
    _selectedRoleType = role;
    fetchStaff();
  }

  void setBranch(int? branchId) {
    _selectedBranchId = branchId;
    fetchStaff();
  }

  Future<void> fetchStaff() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.getStaff(
        search: _searchQuery.trim().isEmpty ? null : _searchQuery.trim(),
        roleType: _selectedRoleType,
        branchId: _selectedBranchId,
      );
      _staff = res.map((s) => StaffMember.fromJson(s as Map<String, dynamic>)).toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

