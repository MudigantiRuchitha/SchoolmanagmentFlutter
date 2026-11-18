import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../notices/notices_screen.dart';
import '../settings/settings_screen.dart';

class AcademicDataScreen extends StatefulWidget {
  const AcademicDataScreen({super.key});

  @override
  State<AcademicDataScreen> createState() => _AcademicDataScreenState();
}

class _AcademicDataScreenState extends State<AcademicDataScreen> {
  final ApiService _api = ApiService(StorageService());

  String _entityType = 'student'; // 'student' | 'staff'
  List<String> _academicYears = [];
  String _selectedYear = '2026-2027';

  List<dynamic> _classes = [];
  String _selectedClass = '';
  List<String> _sections = [];
  String _selectedSection = '';

  String _statusFilter = ''; // '' = all, 'active', 'inactive'
  String _genderFilter = ''; // '' = all, 'Male', 'Female'
  String _search = '';

  bool _isLoading = true;
  List<dynamic> _students = [];
  List<dynamic> _staffList = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final years = await _api.getAcademicYears();
      if (years.isNotEmpty) {
        _academicYears = years.map((y) => y.toString()).toList();
        _selectedYear = _academicYears.first;
      } else {
        _academicYears = ['2026-2027', '2025-2026'];
        _selectedYear = '2026-2027';
      }

      await _loadClasses();
      await _executeFetch();
    } catch (e) {
      if (mounted) setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadClasses() async {
    try {
      final cls = await _api.getAcademicClasses({'academic_year': _selectedYear});
      if (mounted) {
        setState(() {
          _classes = cls;
          _updateSections();
        });
      }
    } catch (_) {}
  }

  void _updateSections() {
    final secSet = <String>{};
    for (final c in _classes) {
      if (c is Map) {
        final cName = (c['className'] ?? c['class_name'] ?? c['name'] ?? '').toString().trim();
        if (_selectedClass.isEmpty || cName.toLowerCase() == _selectedClass.toLowerCase()) {
          if (c['sections'] is List) {
            for (final s in c['sections']) {
              final secStr = s.toString().trim();
              if (secStr.isNotEmpty) secSet.add(secStr);
            }
          }
          final singleSec = (c['section'] ?? '').toString().trim();
          if (singleSec.isNotEmpty) secSet.add(singleSec);
        }
      }
    }
    _sections = secSet.toList()..sort();
    if (_selectedSection.isNotEmpty && !_sections.contains(_selectedSection)) {
      _selectedSection = '';
    }
  }

  Future<void> _executeFetch() async {
    setState(() => _isLoading = true);
    try {
      if (_entityType == 'student') {
        final params = <String, dynamic>{'academic_year': _selectedYear};
        if (_selectedClass.isNotEmpty) params['class_name'] = _selectedClass;
        if (_selectedSection.isNotEmpty) params['section'] = _selectedSection;
        final res = await _api.getAcademicStudents(params);
        if (mounted) {
          setState(() {
            _students = res;
            _isLoading = false;
          });
        }
      } else {
        final params = <String, dynamic>{'academic_year': _selectedYear};
        final res = await _api.getAcademicStaff(params);
        if (mounted) {
          setState(() {
            _staffList = res;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  List<dynamic> get _filteredList {
    final list = _entityType == 'student' ? _students : _staffList;
    return list.where((item) {
      final q = _search.toLowerCase().trim();
      final name = (item['full_name'] ?? item['name'] ?? '').toString().toLowerCase();
      final admNo = (item['admission_no'] ?? item['staff_id'] ?? '').toString().toLowerCase();
      final className = (item['class_name'] ?? '').toString().toLowerCase();
      final contact = (item['phone'] ?? item['contact'] ?? '').toString();

      final matchesSearch = q.isEmpty ||
          name.contains(q) ||
          admNo.contains(q) ||
          className.contains(q) ||
          contact.contains(q);

      final isActive = item['is_active'] == true || item['is_active'] == 1;
      final matchesStatus = _statusFilter.isEmpty ||
          (_statusFilter == 'active' && isActive) ||
          (_statusFilter == 'inactive' && !isActive);

      final gender = (item['gender'] ?? '').toString().toLowerCase();
      final matchesGender = _genderFilter.isEmpty || gender == _genderFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesGender;
    }).toList();
  }

  void _exportCSV() {
    final list = _filteredList;
    if (list.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No records to export.')),
      );
      return;
    }

    final buffer = StringBuffer();
    if (_entityType == 'student') {
      buffer.writeln('#,STUDENT NAME,ADMISSION NO,CLASS & SEC,GENDER,PARENT/GUARDIAN,CONTACT,STATUS');
      for (int i = 0; i < list.length; i++) {
        final s = list[i];
        final name = (s['full_name'] ?? s['name'] ?? '').toString().replaceAll(',', ' ');
        final adm = s['admission_no'] ?? '';
        final cls = '${s['class_name'] ?? ''} ${s['section'] ?? ''}'.trim();
        final gender = s['gender'] ?? '—';
        final parent = (s['parent_name'] ?? '—').toString().replaceAll(',', ' ');
        final phone = s['phone'] ?? '—';
        final status = (s['is_active'] == true || s['is_active'] == 1) ? 'active' : 'inactive';
        buffer.writeln('${i + 1},"$name","$adm","$cls","$gender","$parent","$phone","$status"');
      }
    } else {
      buffer.writeln('#,STAFF NAME,STAFF ID,DEPARTMENT,DESIGNATION,CONTACT,STATUS');
      for (int i = 0; i < list.length; i++) {
        final st = list[i];
        final name = (st['full_name'] ?? st['name'] ?? '').toString().replaceAll(',', ' ');
        final id = st['staff_id'] ?? '';
        final dept = st['department'] ?? '—';
        final desig = st['designation'] ?? '—';
        final phone = st['phone'] ?? '—';
        final status = (st['is_active'] == true || st['is_active'] == 1) ? 'active' : 'inactive';
        buffer.writeln('${i + 1},"$name","$id","$dept","$desig","$phone","$status"');
      }
    }

    Clipboard.setData(ClipboardData(text: buffer.toString()));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Exported ${list.length} records to clipboard as CSV!'),
        backgroundColor: const Color(0xFF10B981),
      ),
    );
  }

  // =========================================================================
  // MAIN BUILD METHOD
  // =========================================================================
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    final filtered = _filteredList;
    final totalCount = filtered.length;
    final activeCount = filtered.where((x) => x['is_active'] == true || x['is_active'] == 1).length;
    final inactiveCount = totalCount - activeCount;

    final maleCount = filtered.where((x) => (x['gender'] ?? '').toString().toLowerCase() == 'male').length;
    final femaleCount = filtered.where((x) => (x['gender'] ?? '').toString().toLowerCase() == 'female').length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const CustomAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. PAGE TITLE & SUBTITLE
            PageHeaderTitle(
              title: 'Academic Data',
              subtitle: 'Mark, update, and manage academic student daily rosters and staff records',
              trailing: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF1E293B),
                  side: const BorderSide(color: Color(0xFFCBD5E1)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                onPressed: _exportCSV,
                icon: const Icon(Icons.download_rounded, size: 16, color: Color(0xFF1E293B)),
                label: const Text('Export CSV', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ),

            // 2. FILTERS CONTAINER
            _buildFiltersContainer(),
            const SizedBox(height: 14),

            // 3. STAT SUMMARY BULLETS ROW
            _buildStatBulletsRow(totalCount, activeCount, inactiveCount, maleCount, femaleCount),
            const SizedBox(height: 16),

            // 4. DATA CONTENT CARD
            _buildDataCard(filtered, totalCount, activeCount, inactiveCount),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // FILTERS BAR (Entity, Year, Class, Section, Status, Gender, Search)
  // =========================================================================
  Widget _buildFiltersContainer() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.filter_list_rounded, size: 18, color: Color(0xFF64748B)),
              SizedBox(width: 4),
              Text('Filters:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B))),
            ],
          ),

          // Entity (Students / Staff)
          _buildFilterDropdown<String>(
            value: _entityType,
            width: 120,
            items: const [
              DropdownMenuItem(value: 'student', child: Text('Students')),
              DropdownMenuItem(value: 'staff', child: Text('Staff')),
            ],
            onChanged: (v) {
              if (v != null) {
                setState(() => _entityType = v);
                _executeFetch();
              }
            },
          ),

          // Academic Year
          Builder(builder: (context) {
            final yearItems = <DropdownMenuItem<String>>[];
            final seenYears = <String>{};
            for (final y in _academicYears) {
              final yStr = y.trim();
              if (yStr.isNotEmpty && seenYears.add(yStr)) {
                yearItems.add(DropdownMenuItem(value: yStr, child: Text(yStr)));
              }
            }
            if (!seenYears.contains(_selectedYear) && _selectedYear.isNotEmpty) {
              yearItems.insert(0, DropdownMenuItem(value: _selectedYear, child: Text(_selectedYear)));
            }

            return _buildFilterDropdown<String>(
              value: _selectedYear,
              width: 130,
              items: yearItems,
              onChanged: (v) {
                if (v != null) {
                  setState(() => _selectedYear = v);
                  _loadClasses();
                  _executeFetch();
                }
              },
            );
          }),

          // Class Dropdown (for students)
          if (_entityType == 'student')
            Builder(builder: (context) {
              final classItems = <DropdownMenuItem<String>>[
                const DropdownMenuItem(value: '', child: Text('All Classes')),
              ];
              final seenClasses = <String>{''};
              for (final c in _classes) {
                if (c is Map) {
                  final cName = (c['className'] ?? c['class_name'] ?? c['name'] ?? '').toString().trim();
                  if (cName.isNotEmpty && seenClasses.add(cName)) {
                    classItems.add(DropdownMenuItem(value: cName, child: Text(cName)));
                  }
                }
              }

              return _buildFilterDropdown<String>(
                value: _selectedClass,
                width: 130,
                items: classItems,
                onChanged: (v) {
                  setState(() {
                    _selectedClass = v ?? '';
                    _updateSections();
                  });
                  _executeFetch();
                },
              );
            }),

          // Section Dropdown
          if (_entityType == 'student')
            Builder(builder: (context) {
              final secItems = <DropdownMenuItem<String>>[
                const DropdownMenuItem(value: '', child: Text('All Sections')),
              ];
              final seenSecs = <String>{''};
              for (final s in _sections) {
                final sec = s.trim();
                if (sec.isNotEmpty && seenSecs.add(sec)) {
                  secItems.add(DropdownMenuItem(value: sec, child: Text('Section $sec')));
                }
              }

              return _buildFilterDropdown<String>(
                value: _selectedSection,
                width: 120,
                items: secItems,
                onChanged: (v) {
                  setState(() => _selectedSection = v ?? '');
                  _executeFetch();
                },
              );
            }),

          // Status Dropdown
          _buildFilterDropdown<String>(
            value: _statusFilter,
            width: 120,
            items: const [
              DropdownMenuItem(value: '', child: Text('All Statuses')),
              DropdownMenuItem(value: 'active', child: Text('Active Only')),
              DropdownMenuItem(value: 'inactive', child: Text('Inactive Only')),
            ],
            onChanged: (v) => setState(() => _statusFilter = v ?? ''),
          ),

          // Gender Dropdown
          _buildFilterDropdown<String>(
            value: _genderFilter,
            width: 120,
            items: const [
              DropdownMenuItem(value: '', child: Text('All Genders')),
              DropdownMenuItem(value: 'Male', child: Text('Male')),
              DropdownMenuItem(value: 'Female', child: Text('Female')),
            ],
            onChanged: (v) => setState(() => _genderFilter = v ?? ''),
          ),

          // Search Input
          Container(
            width: 220,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: TextField(
              style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
              decoration: const InputDecoration(
                isDense: true,
                hintText: 'Search classes, sections, teachers..',
                hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                prefixIcon: Icon(Icons.search_rounded, size: 16, color: Color(0xFF94A3B8)),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterDropdown<T>({
    required T value,
    required double width,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    // 1. Deduplicate items by value
    final seen = <T>{};
    final uniqueItems = <DropdownMenuItem<T>>[];
    for (final item in items) {
      if (item.value != null && seen.add(item.value as T)) {
        uniqueItems.add(item);
      }
    }

    // 2. Ensure value exists in uniqueItems, else fallback
    T? safeValue = value;
    if (!uniqueItems.any((item) => item.value == safeValue)) {
      safeValue = uniqueItems.isNotEmpty ? uniqueItems.first.value : null;
    }

    return Container(
      width: width,
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: safeValue,
          isExpanded: true,
          style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
          items: uniqueItems,
          onChanged: onChanged,
        ),
      ),
    );
  }

  // =========================================================================
  // STAT SUMMARY BULLETS ROW
  // =========================================================================
  Widget _buildStatBulletsRow(int total, int active, int inactive, int male, int female) {
    return Wrap(
      spacing: 18,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _buildBulletItem('$total Total', const Color(0xFF6366F1)),
        _buildBulletItem('$active Active', const Color(0xFF10B981)),
        _buildBulletItem('$inactive Inactive', const Color(0xFFEF4444)),
        _buildBulletItem('$male Male', const Color(0xFFF59E0B)),
        _buildBulletItem('$female Female', const Color(0xFFA855F7)),
      ],
    );
  }

  Widget _buildBulletItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
        ),
      ],
    );
  }

  // =========================================================================
  // DATA CONTENT CARD (TABLE)
  // =========================================================================
  Widget _buildDataCard(List<dynamic> list, int total, int active, int inactive) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Subheader
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              children: [
                Text(
                  _entityType == 'student'
                      ? 'All Classes  Academic Year: $_selectedYear'
                      : 'Staff Members  Academic Year: $_selectedYear',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(width: 14),
                _buildSmallBadge('$total ${_entityType == 'student' ? 'Students' : 'Staff'}', const Color(0xFFF1F5F9), const Color(0xFF475569)),
                const SizedBox(width: 6),
                _buildSmallBadge('$active Active', const Color(0xFFDCFCE7), const Color(0xFF16A34A)),
                const SizedBox(width: 6),
                _buildSmallBadge('$inactive Inactive', const Color(0xFFFEE2E2), const Color(0xFFDC2626)),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          if (_isLoading)
            const SizedBox(
              height: 250,
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5))),
            )
          else if (list.isEmpty)
            Container(
              height: 220,
              alignment: Alignment.center,
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.school_outlined, size: 40, color: Color(0xFF94A3B8)),
                  SizedBox(height: 10),
                  Text('No academic records found', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  SizedBox(height: 4),
                  Text('Try clearing filters or switching academic year', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
            )
          else
            ClipRRect(
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 980),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Table Headers
                      Container(
                        color: const Color(0xFFF8FAFC),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: _entityType == 'student'
                              ? const [
                                  SizedBox(width: 40, child: Text('#', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 180, child: Text('STUDENT NAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 140, child: Text('ADMISSION NO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 140, child: Text('CLASS & SEC', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 100, child: Text('GENDER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 160, child: Text('PARENT / GUARDIAN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 140, child: Text('CONTACT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 80, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                ]
                              : const [
                                  SizedBox(width: 40, child: Text('#', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 200, child: Text('STAFF NAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 130, child: Text('STAFF ID', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 160, child: Text('DEPARTMENT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 160, child: Text('DESIGNATION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 150, child: Text('CONTACT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                  SizedBox(width: 80, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                                ],
                        ),
                      ),
                      const Divider(height: 1, color: Color(0xFFE2E8F0)),

                      // Table Rows
                      for (int i = 0; i < list.length; i++) ...[
                        _buildTableRow(list[i], i + 1),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTableRow(dynamic item, int index) {
    final name = (item['full_name'] ?? item['name'] ?? '—').toString();
    final isActive = item['is_active'] == true || item['is_active'] == 1;

    if (_entityType == 'student') {
      final adm = (item['admission_no'] ?? item['roll_number'] ?? '—').toString();
      final cls = item['class_name'] ?? '—';
      final sec = item['section'] ?? '';
      final classSec = sec.isNotEmpty ? '$cls • $sec' : cls;
      final gender = item['gender'] ?? '—';
      final parent = item['parent_name'] ?? '—';
      final contact = item['phone'] ?? item['parent_phone'] ?? '—';

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(width: 40, child: Text('$index', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
            SizedBox(width: 180, child: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)))),
            SizedBox(width: 140, child: Text(adm, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)))),
            SizedBox(width: 140, child: Text(classSec, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
            SizedBox(width: 100, child: Text(gender, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
            SizedBox(width: 160, child: Text(parent, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
            SizedBox(width: 140, child: Text(contact, style: const TextStyle(fontSize: 12, color: Color(0xFF475569)))),
            SizedBox(
              width: 80,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isActive ? 'active' : 'inactive',
                    style: TextStyle(
                      color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    } else {
      final staffId = (item['staff_id'] ?? '—').toString();
      final dept = item['department'] ?? '—';
      final desig = item['designation'] ?? '—';
      final contact = item['phone'] ?? item['email'] ?? '—';

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(width: 40, child: Text('$index', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
            SizedBox(width: 200, child: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)))),
            SizedBox(width: 130, child: Text(staffId, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)))),
            SizedBox(width: 160, child: Text(dept, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
            SizedBox(width: 160, child: Text(desig, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
            SizedBox(width: 150, child: Text(contact, style: const TextStyle(fontSize: 12, color: Color(0xFF475569)))),
            SizedBox(
              width: 80,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isActive ? 'active' : 'inactive',
                    style: TextStyle(
                      color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }
  }

  Widget _buildSmallBadge(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg)),
    );
  }
}
