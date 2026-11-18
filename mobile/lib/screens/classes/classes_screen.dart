import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../attendance/student_attendance_screen.dart';

class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  late final ApiService _api;
  List<dynamic> _classes = [];
  List<dynamic> _branches = [];
  List<dynamic> _staff = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
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
    final capCtrl = TextEditingController(text: cls?['capacity']?.toString() ?? '40');
    int? selectedBranchId = cls?['branch_id'] != null ? int.tryParse(cls!['branch_id'].toString()) : (_branches.isNotEmpty ? _branches.first['id'] : null);
    int? selectedTeacherId = cls?['class_teacher_id'] != null ? int.tryParse(cls!['class_teacher_id'].toString()) : null;

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
                  decoration: const InputDecoration(labelText: 'Class / Grade *', hintText: 'e.g. Grade 10'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: secCtrl,
                  decoration: const InputDecoration(labelText: 'Section *', hintText: 'e.g. A, B, Blue'),
                ),
                const SizedBox(height: 10),
                if (_branches.isNotEmpty) ...[
                  Builder(builder: (context) {
                    final bItems = <DropdownMenuItem<int?>>[];
                    final seenB = <int>{};
                    for (final b in _branches) {
                      final id = b['id'] is int ? b['id'] as int : int.tryParse(b['id']?.toString() ?? '');
                      if (id != null && seenB.add(id)) {
                        bItems.add(DropdownMenuItem<int?>(
                          value: id,
                          child: Text(b['name'] ?? '', style: const TextStyle(fontSize: 13)),
                        ));
                      }
                    }
                    final safeBId = bItems.any((i) => i.value == selectedBranchId) ? selectedBranchId : null;

                    return DropdownButtonFormField<int?>(
                      value: safeBId,
                      decoration: const InputDecoration(labelText: 'Branch / Campus'),
                      items: bItems,
                      onChanged: (v) => setDlgState(() => selectedBranchId = v),
                    );
                  }),
                  const SizedBox(height: 10),
                ],
                if (_staff.isNotEmpty) ...[
                  Builder(builder: (context) {
                    final tItems = <DropdownMenuItem<int?>>[
                      const DropdownMenuItem<int?>(value: null, child: Text('No Class Teacher Assigned')),
                    ];
                    final seenT = <int?>{null};
                    for (final s in _staff) {
                      final id = s['id'] is int ? s['id'] as int : int.tryParse(s['id']?.toString() ?? '');
                      if (id != null && seenT.add(id)) {
                        tItems.add(DropdownMenuItem<int?>(
                          value: id,
                          child: Text(s['full_name'] ?? s['name'] ?? '', style: const TextStyle(fontSize: 13)),
                        ));
                      }
                    }
                    final safeTId = tItems.any((i) => i.value == selectedTeacherId) ? selectedTeacherId : null;

                    return DropdownButtonFormField<int?>(
                      value: safeTId,
                      decoration: const InputDecoration(labelText: 'Class Teacher'),
                      items: tItems,
                      onChanged: (v) => setDlgState(() => selectedTeacherId = v),
                    );
                  }),
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
                        decoration: const InputDecoration(labelText: 'Capacity'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
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
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
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
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(),
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
                ? Center(child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.danger)))
                : ListView(
                    padding: const EdgeInsets.only(left: 14, right: 14, top: 14, bottom: 84),
                    children: [
                      const PageHeaderTitle(
                        title: 'Classes & Sections',
                        subtitle: 'Manage grade levels, class rosters, and assigned class teachers',
                      ),
                      if (_classes.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Center(child: Text('No classes found.')),
                        )
                      else
                        ..._classes.map((c) {
                          final studentCount = c['student_count'] ?? c['students_count'] ?? 0;

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Card(
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
                                          child: const Icon(Icons.meeting_room_rounded, color: AppTheme.primary),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                '${c['name']} - Section ${c['section'] ?? ""}'.trim(),
                                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                                              ),
                                              if (c['branch_name'] != null)
                                                Text(c['branch_name'], style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                                            ],
                                          ),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.edit_outlined, size: 18),
                                          onPressed: () => _showClassDialog(c),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.danger),
                                          onPressed: () => _deleteClass(c),
                                        ),
                                      ],
                                    ),
                                    const Divider(height: 20),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            const Icon(Icons.person_outline_rounded, size: 16, color: AppTheme.textMuted),
                                            const SizedBox(width: 4),
                                            Text(
                                              c['class_teacher_name'] ?? 'No class teacher',
                                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                            ),
                                          ],
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primaryLight,
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            '$studentCount Students',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primary),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    SizedBox(
                                      width: double.infinity,
                                      child: OutlinedButton.icon(
                                        icon: const Icon(Icons.how_to_reg_rounded, size: 16),
                                        label: const Text('Take Class Attendance', style: TextStyle(fontSize: 12)),
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(builder: (_) => const StudentAttendanceScreen()),
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
      ),
    );
  }
}
