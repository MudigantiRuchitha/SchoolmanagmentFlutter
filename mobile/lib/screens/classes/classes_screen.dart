import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/admin_ui.dart';
import '../attendance/student_attendance_screen.dart';

class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  final ApiService _api = ApiService(StorageService());
  List<dynamic> _classes = [];
  List<dynamic> _branches = [];
  List<dynamic> _staff = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _searchQuery = '';
  int? _branchFilterId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final classes = await _api.getClasses();
      final branches = await _api.getBranches();
      final staff = await _api.getStaff();
      setState(() {
        _classes = classes;
        _branches = branches;
        _staff = staff;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showClassDialog([Map<String, dynamic>? cls]) {
    final isEdit = cls != null;
    final nameCtrl = TextEditingController(text: cls?['name'] ?? '');
    final secCtrl = TextEditingController(text: cls?['section'] ?? '');
    final roomCtrl = TextEditingController(text: cls?['room_number'] ?? '');
    final capCtrl = TextEditingController(
      text: cls?['capacity']?.toString() ?? '40',
    );
    int? selectedBranchId = cls?['branch_id'] != null
        ? int.tryParse(cls!['branch_id'].toString())
        : (_branches.isNotEmpty ? _branches.first['id'] : null);
    int? selectedTeacherId = cls?['class_teacher_id'] != null
        ? int.tryParse(cls!['class_teacher_id'].toString())
        : null;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          title: Text(isEdit ? 'Edit Class' : 'Create New Class'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Class / Grade *',
                    hintText: 'e.g. Grade 10',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: secCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Section *',
                    hintText: 'e.g. A, B, Blue',
                  ),
                ),
                const SizedBox(height: 10),
                if (_branches.isNotEmpty) ...[
                  DropdownButtonFormField<int?>(
                    initialValue: selectedBranchId,
                    decoration: const InputDecoration(
                      labelText: 'Branch / Campus',
                    ),
                    items: _branches
                        .map(
                          (b) => DropdownMenuItem<int?>(
                            value: b['id'] is int
                                ? b['id'] as int
                                : int.tryParse(b['id'].toString()),
                            child: Text(
                              b['name'] ?? '',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setDlgState(() => selectedBranchId = v),
                  ),
                  const SizedBox(height: 10),
                ],
                if (_staff.isNotEmpty) ...[
                  DropdownButtonFormField<int?>(
                    initialValue: selectedTeacherId,
                    decoration: const InputDecoration(
                      labelText: 'Class Teacher',
                    ),
                    items: [
                      const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('No Class Teacher Assigned'),
                      ),
                      ..._staff.map(
                        (s) => DropdownMenuItem<int?>(
                          value: s['id'] is int
                              ? s['id'] as int
                              : int.tryParse(s['id'].toString()),
                          child: Text(
                            s['full_name'] ?? s['name'] ?? '',
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setDlgState(() => selectedTeacherId = v),
                  ),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: roomCtrl,
                        decoration: const InputDecoration(labelText: 'Room No'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: capCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Capacity',
                        ),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final sec = secCtrl.text.trim();
                if (name.isEmpty || sec.isEmpty) return;

                final payload = {
                  'name': name,
                  'section': sec,
                  'branchId': selectedBranchId,
                  'classTeacherId': selectedTeacherId,
                  'roomNumber': roomCtrl.text.trim(),
                  'capacity': int.tryParse(capCtrl.text.trim()) ?? 40,
                };

                Navigator.pop(ctx);
                try {
                  if (isEdit) {
                    await _api.updateClass(cls['id'], payload);
                  } else {
                    await _api.createClass(payload);
                  }
                  _loadData();
                } catch (e) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Error: $e')));
                }
              },
              child: Text(isEdit ? 'Update' : 'Create'),
            ),
          ],
        ),
      ),
    );
  }

  void _deleteClass(dynamic cls) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Class?'),
        content: Text('Delete "${cls['name']} ${cls['section'] ?? ""}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.deleteClass(cls['id']);
        _loadData();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final visibleClasses = _classes.where((rawClass) {
      final cls = rawClass as Map<String, dynamic>;
      final query = _searchQuery.trim().toLowerCase();
      final matchesQuery =
          query.isEmpty ||
          '${cls['name'] ?? ''} ${cls['section'] ?? ''} ${cls['class_teacher_name'] ?? ''} ${cls['academic_group_name'] ?? ''}'
              .toLowerCase()
              .contains(query);
      final branchId = cls['branch_id'] is int
          ? cls['branch_id'] as int
          : int.tryParse('${cls['branch_id'] ?? ''}');
      return matchesQuery &&
          (_branchFilterId == null || branchId == _branchFilterId);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Classes & Sections')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showClassDialog(),
        icon: const Icon(Icons.school_rounded),
        label: const Text('New Class'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppTheme.primary,
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
                        color: AppTheme.danger,
                        size: 36,
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Classes could not be loaded.',
                        style: TextStyle(fontWeight: FontWeight.w700),
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
                        onPressed: _loadData,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Try again'),
                      ),
                    ],
                  ),
                ),
              )
            : _classes.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.meeting_room_outlined,
                      size: 44,
                      color: AppTheme.textMuted,
                    ),
                    const SizedBox(height: 10),
                    const Text('No classes have been created yet.'),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => _showClassDialog(),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Create first class'),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.only(
                  left: 14,
                  right: 14,
                  top: 14,
                  bottom: 84,
                ),
                itemCount:
                    visibleClasses.length + (visibleClasses.isEmpty ? 4 : 3),
                itemBuilder: (ctx, idx) {
                  if (idx == 0) {
                    return const AdminPageHeading(
                      title: 'Classes & Sections',
                      subtitle:
                          'Manage class groups, sections, and assigned staff.',
                      horizontalPadding: 0,
                    );
                  }
                  if (idx == 1) {
                    final branchCount = _branches.length;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: AdminMetricCard(
                              label: 'Total Classes',
                              value: '${_classes.length}',
                              icon: Icons.meeting_room_rounded,
                              color: AppTheme.primary,
                              backgroundColor: AppTheme.primaryLight,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: AdminMetricCard(
                              label: 'Branches',
                              value: '$branchCount',
                              icon: Icons.business_rounded,
                              color: AppTheme.secondary,
                              backgroundColor: AppTheme.secondaryLight,
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  if (idx == 2) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        children: [
                          TextField(
                            onChanged: (value) =>
                                setState(() => _searchQuery = value),
                            decoration: const InputDecoration(
                              hintText: 'Search class, section, or teacher...',
                              prefixIcon: Icon(Icons.search_rounded),
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          DropdownButtonFormField<int?>(
                            initialValue: _branchFilterId,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(
                                Icons.business_outlined,
                                size: 18,
                              ),
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                            ),
                            isExpanded: true,
                            items: [
                              const DropdownMenuItem<int?>(
                                value: null,
                                child: Text('All Branches'),
                              ),
                              ..._branches.map((branch) {
                                final id = branch['id'] is int
                                    ? branch['id'] as int
                                    : int.tryParse('${branch['id'] ?? ''}');
                                return DropdownMenuItem<int?>(
                                  value: id,
                                  child: Text(
                                    branch['name']?.toString() ?? 'Branch',
                                  ),
                                );
                              }),
                            ],
                            onChanged: (value) =>
                                setState(() => _branchFilterId = value),
                          ),
                        ],
                      ),
                    );
                  }
                  if (visibleClasses.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: Text(
                          'No classes match these filters.',
                          style: TextStyle(color: AppTheme.textSecondary),
                        ),
                      ),
                    );
                  }
                  final c = visibleClasses[idx - 3] as Map<String, dynamic>;
                  final studentCount =
                      c['student_count'] ?? c['students_count'] ?? 0;
                  final statusLabel =
                      c['status']?.toString() ??
                      (c['is_active'] is bool
                          ? (c['is_active'] == true ? 'Active' : 'Inactive')
                          : null);

                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryLight,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.meeting_room_rounded,
                                  color: AppTheme.primary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${c['name']} - Section ${c['section'] ?? ""}'
                                          .trim(),
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textPrimary,
                                      ),
                                    ),
                                    if (c['branch_name'] != null)
                                      Text(
                                        c['branch_name'],
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppTheme.textSecondary,
                                        ),
                                      ),
                                    if (c['academic_group_name'] != null ||
                                        c['academic_year'] != null)
                                      Text(
                                        [
                                          if (c['academic_group_name'] != null)
                                            c['academic_group_name'].toString(),
                                          if (c['academic_year'] != null)
                                            c['academic_year'].toString(),
                                        ].join(' • '),
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.textMuted,
                                        ),
                                      ),
                                    if (statusLabel != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color:
                                              statusLabel.toLowerCase() ==
                                                  'active'
                                              ? AppTheme.successLight
                                              : AppTheme.dangerLight,
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                        child: Text(
                                          statusLabel,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color:
                                                statusLabel.toLowerCase() ==
                                                    'active'
                                                ? AppTheme.success
                                                : AppTheme.danger,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 18),
                                onPressed: () => _showClassDialog(c),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline_rounded,
                                  size: 18,
                                  color: AppTheme.danger,
                                ),
                                onPressed: () => _deleteClass(c),
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          Wrap(
                            spacing: 12,
                            runSpacing: 8,
                            alignment: WrapAlignment.spaceBetween,
                            children: [
                              SizedBox(
                                width: MediaQuery.sizeOf(context).width * 0.53,
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.person_outline_rounded,
                                      size: 16,
                                      color: AppTheme.textMuted,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      c['class_teacher_name'] ??
                                          'No class teacher',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppTheme.textSecondary,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryLight,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  '$studentCount Students',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              icon: const Icon(
                                Icons.how_to_reg_rounded,
                                size: 16,
                              ),
                              label: const Text(
                                'Take Class Attendance',
                                style: TextStyle(fontSize: 12),
                              ),
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        const StudentAttendanceScreen(),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
