import 'package:flutter/material.dart';
import '../models/staff_model.dart';
import '../services/api_service.dart';

class StaffProvider extends ChangeNotifier {
  final ApiService _api;

  List<StaffMember> _allStaff = [];
  String _searchQuery = '';
  String? _selectedRoleType;
  int? _selectedBranchId;
  bool _isLoading = false;
  String? _errorMessage;

  StaffProvider(this._api);

  List<StaffMember> get staff {
    if (_selectedRoleType == null || _selectedRoleType!.isEmpty) {
      return _allStaff;
    }
    final target = _selectedRoleType!.toLowerCase().trim();
    return _allStaff.where((member) {
      final role = member.roleType.toLowerCase().trim();
      if (target == 'non-teaching' || target == 'non_teaching') {
        return role == 'non-teaching' || role == 'non_teaching';
      }
      return role == target;
    }).toList();
  }

  List<StaffMember> get allStaff => _allStaff;
  String get searchQuery => _searchQuery;
  String? get selectedRoleType => _selectedRoleType;
  int? get selectedBranchId => _selectedBranchId;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  int get totalCount => _allStaff.length;

  int get teachingCount =>
      _allStaff.where((s) => s.roleType.toLowerCase().trim() == 'teaching').length;

  int get nonTeachingCount => _allStaff.where((s) {
        final r = s.roleType.toLowerCase().trim();
        return r == 'non-teaching' || r == 'non_teaching';
      }).length;

  int get managementCount =>
      _allStaff.where((s) => s.roleType.toLowerCase().trim() == 'management').length;

  void setSearch(String query) {
    _searchQuery = query;
    fetchStaff();
  }

  void setRoleType(String? role) {
    if (role == null || role.isEmpty || role.toLowerCase() == 'all') {
      _selectedRoleType = null;
    } else {
      _selectedRoleType = role.toLowerCase().trim();
    }
    notifyListeners();
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
        branchId: _selectedBranchId,
      );
      _allStaff = res
          .map((s) => StaffMember.fromJson(s as Map<String, dynamic>))
          .toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
