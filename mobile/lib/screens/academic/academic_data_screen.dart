import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../services/api_service.dart';

class AcademicDataScreen extends StatefulWidget {
  const AcademicDataScreen({super.key});

  @override
  State<AcademicDataScreen> createState() => _AcademicDataScreenState();
}

class _AcademicDataScreenState extends State<AcademicDataScreen> {
  late final ApiService _api;

  String _entityType = 'student'; // 'student' or 'staff'
  List<dynamic> _years = [];
  String? _selectedYear;
  List<dynamic> _classes = [];
  int? _selectedClassId;
  String _staffType = 'teaching'; // 'teaching' or 'non-teaching'

  List<dynamic> _results = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = context.read<ApiService>();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final years = await _api.getAcademicYears();
      final classes = await _api.getClasses();
      if (!mounted) return;
      setState(() {
        _years = years;
        if (_years.isNotEmpty) {
          _selectedYear =
              _years.first['name'] ?? _years.first['year']?.toString();
        }
        _classes = classes;
      });
      _search();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _search() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_entityType == 'student') {
        final params = <String, dynamic>{};
        if (_selectedYear != null) params['year'] = _selectedYear;
        if (_selectedClassId != null) params['class_id'] = _selectedClassId;
        final res = await _api.getAcademicStudents(params);
        if (!mounted) return;
        setState(() => _results = res);
      } else {
        final params = <String, dynamic>{'role_type': _staffType};
        final res = await _api.getAcademicStaff(params);
        if (!mounted) return;
        setState(() => _results = res);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Academic Data Explorer')),
      body: Column(
        children: [
          // Filter Form
          Container(
            padding: const EdgeInsets.all(14),
            color: AppTheme.surface,
            child: Column(
              children: [
                // Entity Selector: Students vs Staff
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() => _entityType = 'student');
                          _search();
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _entityType == 'student'
                                ? AppTheme.primary
                                : AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.school_rounded,
                                  size: 18,
                                  color: _entityType == 'student'
                                      ? Colors.white
                                      : AppTheme.primary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Students Data',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: _entityType == 'student'
                                        ? Colors.white
                                        : AppTheme.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() => _entityType = 'staff');
                          _search();
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _entityType == 'staff'
                                ? AppTheme.primary
                                : AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.people_rounded,
                                  size: 18,
                                  color: _entityType == 'staff'
                                      ? Colors.white
                                      : AppTheme.primary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Staff Data',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: _entityType == 'staff'
                                        ? Colors.white
                                        : AppTheme.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Secondary filters based on entity
                if (_entityType == 'student') ...[
                  Row(
                    children: [
                      if (_years.isNotEmpty) ...[
                        Expanded(
                          child: DropdownButtonFormField<String?>(
                            initialValue: _selectedYear,
                            decoration: const InputDecoration(
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 8,
                              ),
                              labelText: 'Academic Year',
                            ),
                            items: _years.map((y) {
                              final name = (y['name'] ?? y['year'] ?? '')
                                  .toString();
                              return DropdownMenuItem(
                                value: name,
                                child: Text(
                                  name,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              );
                            }).toList(),
                            onChanged: (v) {
                              setState(() => _selectedYear = v);
                              _search();
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: DropdownButtonFormField<int?>(
                          initialValue: _selectedClassId,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                            labelText: 'Class',
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: null,
                              child: Text(
                                'All Classes',
                                style: TextStyle(fontSize: 12),
                              ),
                            ),
                            ..._classes.map(
                              (c) => DropdownMenuItem(
                                value: c['id'] is int
                                    ? c['id']
                                    : int.tryParse(c['id'].toString()),
                                child: Text(
                                  '${c['name']} ${c['section'] ?? ""}'.trim(),
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                            ),
                          ],
                          onChanged: (v) {
                            setState(() => _selectedClassId = v);
                            _search();
                          },
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _staffType,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                            labelText: 'Staff Category',
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'teaching',
                              child: Text('Teaching Staff'),
                            ),
                            DropdownMenuItem(
                              value: 'non-teaching',
                              child: Text('Non-Teaching Staff'),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) {
                              setState(() => _staffType = v);
                              _search();
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // Total Results Badge
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${_results.length} ${_entityType == "student" ? "Students" : "Staff"} Found',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textSecondary,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  onPressed: _search,
                ),
              ],
            ),
          ),

          // Results List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.cloud_off_rounded,
                            size: 36,
                            color: AppTheme.danger,
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Academic data could not be loaded.',
                            style: TextStyle(fontWeight: FontWeight.w700),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 12,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: _loadInitialData,
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Try again'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _results.isEmpty
                ? Center(child: Text('No academic $_entityType records found.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: _results.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, idx) {
                      final item = _results[idx];
                      final isStudent = _entityType == 'student';

                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppTheme.primaryLight,
                            child: Text(
                              (item['name'] ?? item['full_name'] ?? '?')[0]
                                  .toUpperCase(),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppTheme.primary,
                              ),
                            ),
                          ),
                          title: Text(
                            item['name'] ?? item['full_name'] ?? 'Record',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: Text(
                            isStudent
                                ? 'Adm: ${item['admission_no'] ?? "—"} • Class: ${item['class_name'] ?? ""} ${item['section'] ?? ""}'
                                : 'Designation: ${item['designation'] ?? item['role_type'] ?? "Staff"} • ID: ${item['staff_id'] ?? "#${item['id']}"}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          trailing: item['branch_name'] != null
                              ? Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppTheme.cardBg,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: AppTheme.border),
                                  ),
                                  child: Text(
                                    item['branch_name'],
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                )
                              : null,
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
