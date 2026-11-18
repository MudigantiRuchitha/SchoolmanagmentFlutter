import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../providers/students_provider.dart';
import '../../widgets/admin_ui.dart';
import '../../widgets/custom_app_bar.dart';
import 'student_detail_screen.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  final _searchController = TextEditingController();
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<StudentsProvider>();
      p.initFilters();
      p.fetchStudents();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stuProv = context.watch<StudentsProvider>();
    final students = stuProv.students;
    final visibleStudents = students.where((student) {
      if (_statusFilter == 'active') return student.isActive;
      if (_statusFilter == 'inactive') return !student.isActive;
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: Navigator.canPop(context) ? const CustomAppBar() : null,
      body: RefreshIndicator(
      onRefresh: () => stuProv.fetchStudents(),
      color: AppTheme.primary,
      child: Column(
        children: [
          const AdminPageHeading(
            title: 'Students',
            subtitle: 'View and manage student records across your school.',
          ),
          // Search & Filter Toolbar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppTheme.surface,
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by name, admission no, roll no...',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              stuProv.setSearch('');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  onChanged: (v) => stuProv.setSearch(v),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int?>(
                        initialValue: stuProv.selectedBranchId,
                        decoration: const InputDecoration(
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 8,
                          ),
                          prefixIcon: Icon(Icons.business_outlined, size: 17),
                        ),
                        hint: const Text(
                          'All Branches',
                          style: TextStyle(fontSize: 12),
                        ),
                        isExpanded: true,
                        items: [
                          const DropdownMenuItem(
                            value: null,
                            child: Text(
                              'All Branches',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                          ...stuProv.branches.map((branch) {
                            final id = branch['id'] is int
                                ? branch['id']
                                : int.tryParse(branch['id'].toString());
                            return DropdownMenuItem(
                              value: id,
                              child: Text(
                                branch['name']?.toString() ?? 'Branch',
                                style: const TextStyle(fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }),
                        ],
                        onChanged: (val) => stuProv.setBranchFilter(val),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<int?>(
                        initialValue: stuProv.selectedClassId,
                        decoration: const InputDecoration(
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 8,
                          ),
                          prefixIcon: Icon(
                            Icons.meeting_room_rounded,
                            size: 17,
                          ),
                        ),
                        hint: const Text(
                          'All Classes',
                          style: TextStyle(fontSize: 12),
                        ),
                        isExpanded: true,
                        items: [
                          const DropdownMenuItem(
                            value: null,
                            child: Text(
                              'All Classes',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                          ...stuProv.classes.map((c) {
                            final id = c['id'] is int
                                ? c['id']
                                : int.tryParse(c['id'].toString());
                            final name =
                                '${c['name'] ?? ''} ${c['section'] ?? ''}'
                                    .trim();
                            return DropdownMenuItem(
                              value: id,
                              child: Text(
                                name,
                                style: const TextStyle(fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }),
                        ],
                        onChanged: (val) => stuProv.setClassFilter(val),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _statusFilter,
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    prefixIcon: Icon(Icons.toggle_on_outlined, size: 18),
                  ),
                  isExpanded: true,
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All Statuses')),
                    DropdownMenuItem(value: 'active', child: Text('Active')),
                    DropdownMenuItem(
                      value: 'inactive',
                      child: Text('Inactive'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _statusFilter = value);
                  },
                ),
              ],
            ),
          ),

          SizedBox(
            height: 88,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              scrollDirection: Axis.horizontal,
              children: [
                SizedBox(
                  width: 158,
                  child: AdminMetricCard(
                    label: 'Total Students',
                    value: '${students.length}',
                    icon: Icons.people_alt_rounded,
                    color: AppTheme.primary,
                    backgroundColor: AppTheme.primaryLight,
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 158,
                  child: AdminMetricCard(
                    label: 'Male',
                    value:
                        '${students.where((s) => (s.gender ?? '').toLowerCase() == 'male').length}',
                    icon: Icons.male_rounded,
                    color: AppTheme.secondary,
                    backgroundColor: AppTheme.secondaryLight,
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 158,
                  child: AdminMetricCard(
                    label: 'Female',
                    value:
                        '${students.where((s) => (s.gender ?? '').toLowerCase() == 'female').length}',
                    icon: Icons.female_rounded,
                    color: AppTheme.warning,
                    backgroundColor: AppTheme.warningLight,
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 158,
                  child: AdminMetricCard(
                    label: 'Active Students',
                    value: '${students.where((s) => s.isActive).length}',
                    icon: Icons.check_circle_outline_rounded,
                    color: AppTheme.success,
                    backgroundColor: AppTheme.successLight,
                  ),
                ),
              ],
            ),
          ),

          // Total count header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${visibleStudents.length} Students Listed',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),

          // Students List
          Expanded(
            child: stuProv.isLoading
                ? const Center(child: CircularProgressIndicator())
                : visibleStudents.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.people_outline_rounded,
                          size: 48,
                          color: AppTheme.textMuted,
                        ),
                        SizedBox(height: 12),
                        Text(
                          'No students matched your query.',
                          style: TextStyle(color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.only(
                      left: 14,
                      right: 14,
                      bottom: 80,
                    ),
                    itemCount: visibleStudents.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, idx) {
                      final student = visibleStudents[idx];
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          leading: CircleAvatar(
                            radius: 22,
                            backgroundColor: AppTheme.primaryLight,
                            child: Text(
                              student.fullName.isNotEmpty
                                  ? student.fullName[0].toUpperCase()
                                  : 'S',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppTheme.primary,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          title: Text(
                            student.fullName,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 2),
                              Text(
                                'Adm: ${student.admissionNo ?? "—"} • Roll: ${student.rollNo ?? "—"}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                              if (student.className != null)
                                Text(
                                  '${student.className} ${student.section ?? ""}'
                                      .trim(),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              if (student.branchName != null ||
                                  student.gender != null)
                                Text(
                                  [
                                    if (student.gender != null &&
                                        student.gender!.isNotEmpty)
                                      student.gender!,
                                    if (student.branchName != null &&
                                        student.branchName!.isNotEmpty)
                                      student.branchName!,
                                  ].join(' • '),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.textMuted,
                                  ),
                                ),
                              Text(
                                student.isActive ? 'Active' : 'Inactive',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: student.isActive
                                      ? AppTheme.success
                                      : AppTheme.danger,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          trailing: const Icon(
                            Icons.chevron_right_rounded,
                            color: AppTheme.textMuted,
                          ),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    StudentDetailScreen(student: student),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    ),
  );
}
}
