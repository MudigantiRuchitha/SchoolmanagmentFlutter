import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/students_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import 'student_detail_screen.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  final _searchController = TextEditingController();

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

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: Navigator.canPop(context) ? const CustomAppBar() : null,
      body: RefreshIndicator(
        onRefresh: () => stuProv.fetchStudents(),
        color: AppTheme.primary,
        child: Column(
          children: [
            Container(
              color: Colors.white,
              padding: const EdgeInsets.only(left: 16, right: 16, top: 14),
              child: const PageHeaderTitle(
                title: 'Students',
                subtitle: 'Manage student enrollment, profiles, and class allocations',
              ),
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
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  onChanged: (v) => stuProv.setSearch(v),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Builder(builder: (context) {
                        final classItems = <DropdownMenuItem<int?>>[
                          const DropdownMenuItem(value: null, child: Text('All Classes', style: TextStyle(fontSize: 13))),
                        ];
                        final seenC = <int?>{null};
                        for (final c in stuProv.classes) {
                          final id = c['id'] is int ? c['id'] : int.tryParse(c['id']?.toString() ?? '');
                          if (id != null && seenC.add(id)) {
                            final name = '${c['name'] ?? ''} ${c['section'] ?? ''}'.trim();
                            classItems.add(DropdownMenuItem(value: id, child: Text(name.isEmpty ? 'Class #$id' : name, style: const TextStyle(fontSize: 13))));
                          }
                        }
                        final safeClassId = classItems.any((i) => i.value == stuProv.selectedClassId) ? stuProv.selectedClassId : null;

                        return DropdownButtonFormField<int?>(
                          value: safeClassId,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            prefixIcon: Icon(Icons.meeting_room_rounded, size: 18),
                          ),
                          hint: const Text('Filter by Class', style: TextStyle(fontSize: 13)),
                          isExpanded: true,
                          items: classItems,
                          onChanged: (val) => stuProv.setClassFilter(val),
                        );
                      }),
                    ),
                  ],
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
                  '${students.length} Students Listed',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),

          // Students List
          Expanded(
            child: stuProv.isLoading
                ? const Center(child: CircularProgressIndicator())
                : students.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.people_outline_rounded, size: 48, color: AppTheme.textMuted),
                            SizedBox(height: 12),
                            Text('No students matched your query.', style: TextStyle(color: AppTheme.textSecondary)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(left: 14, right: 14, bottom: 80),
                        itemCount: students.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, idx) {
                          final student = students[idx];
                          return Card(
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              leading: CircleAvatar(
                                radius: 22,
                                backgroundColor: AppTheme.primaryLight,
                                child: Text(
                                  student.fullName.isNotEmpty ? student.fullName[0].toUpperCase() : 'S',
                                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary, fontSize: 16),
                                ),
                              ),
                              title: Text(
                                student.fullName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 2),
                                  Text(
                                    'Adm: ${student.admissionNo ?? "—"} • Roll: ${student.rollNo ?? "—"}',
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                  ),
                                  if (student.className != null)
                                    Text(
                                      '${student.className} ${student.section ?? ""}'.trim(),
                                      style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600),
                                    ),
                                ],
                              ),
                              trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => StudentDetailScreen(student: student),
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
