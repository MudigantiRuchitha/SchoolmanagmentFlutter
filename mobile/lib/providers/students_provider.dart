import 'package:flutter/material.dart';
import '../models/student_model.dart';
import '../services/api_service.dart';

class StudentsProvider extends ChangeNotifier {
  final ApiService _api;

  List<Student> _students = [];
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _branches = [];

  String _searchQuery = '';
  int? _selectedClassId;
  int? _selectedBranchId;
  bool _isLoading = false;
  String? _errorMessage;

  StudentsProvider(this._api);

  List<Student> get students => _students;
  List<Map<String, dynamic>> get classes => _classes;
  List<Map<String, dynamic>> get branches => _branches;
  String get searchQuery => _searchQuery;
  int? get selectedClassId => _selectedClassId;
  int? get selectedBranchId => _selectedBranchId;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> initFilters() async {
    try {
      final cls = await _api.getClasses();
      _classes = cls.map((c) => c as Map<String, dynamic>).toList();

      final brs = await _api.getBranches();
      _branches = brs.map((b) => b as Map<String, dynamic>).toList();
      notifyListeners();
    } catch (_) {}
  }

  void setSearch(String query) {
    _searchQuery = query;
    fetchStudents();
  }

  void setClassFilter(int? classId) {
    _selectedClassId = classId;
    fetchStudents();
  }

  void setBranchFilter(int? branchId) {
    _selectedBranchId = branchId;
    fetchStudents();
  }

  Future<void> fetchStudents() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.getStudents(
        search: _searchQuery.trim().isEmpty ? null : _searchQuery.trim(),
        classId: _selectedClassId,
        branchId: _selectedBranchId,
        limit: 150,
      );
      _students = res.map((s) => Student.fromJson(s as Map<String, dynamic>)).toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

