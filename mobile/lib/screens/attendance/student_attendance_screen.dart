import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/students_provider.dart';

class StudentAttendanceScreen extends StatefulWidget {
  const StudentAttendanceScreen({super.key});

  @override
  State<StudentAttendanceScreen> createState() => _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends State<StudentAttendanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<StudentsProvider>().initFilters();
      context.read<AttendanceProvider>().fetchStudentAttendance();
    });
  }

  void _pickDate() async {
    final att = context.read<AttendanceProvider>();
    final picked = await showDatePicker(
      context: context,
      initialDate: att.selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      builder: (ctx, child) {
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: const ColorScheme.light(primary: AppTheme.primary),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      att.setDate(picked);
    }
  }

  void _previousDay() {
    final att = context.read<AttendanceProvider>();
    att.setDate(att.selectedDate.subtract(const Duration(days: 1)));
  }

  void _nextDay() {
    final att = context.read<AttendanceProvider>();
    att.setDate(att.selectedDate.add(const Duration(days: 1)));
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final stuProv = context.watch<StudentsProvider>();
    final records = att.studentRecords;
    final summary = att.studentSummary;

    return RefreshIndicator(
      onRefresh: () => att.fetchStudentAttendance(),
      color: AppTheme.primary,
      child: Column(
        children: [
          // Filter Toolbar (Date & Class)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppTheme.surface,
            child: Column(
              children: [
                // Date picker row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left_rounded),
                      onPressed: _previousDay,
                      tooltip: 'Previous Day',
                    ),
                    InkWell(
                      onTap: _pickDate,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today_rounded, size: 16, color: AppTheme.primary),
                            const SizedBox(width: 8),
                            Text(
                              DateFormat('EEE, dd MMM yyyy').format(att.selectedDate),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.primary),
                            ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right_rounded),
                      onPressed: _nextDay,
                      tooltip: 'Next Day',
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Class dropdown selector
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int?>(
                        initialValue: att.selectedClassId,
                        decoration: const InputDecoration(
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          prefixIcon: Icon(Icons.meeting_room_rounded, size: 18),
                        ),
                        hint: const Text('All Classes & Sections', style: TextStyle(fontSize: 13)),
                        isExpanded: true,
                        items: [
                          const DropdownMenuItem<int?>(
                            value: null,
                            child: Text('All Classes & Sections', style: TextStyle(fontSize: 13)),
                          ),
                          ...stuProv.classes.map((c) {
                            final id = c['id'] is int ? c['id'] : int.tryParse(c['id'].toString());
                            final name = '${c['name'] ?? ''} ${c['section'] ?? ''}'.trim();
                            return DropdownMenuItem<int?>(
                              value: id,
                              child: Text(name.isEmpty ? 'Class #$id' : name, style: const TextStyle(fontSize: 13)),
                            );
                          }),
                        ],
                        onChanged: (val) => att.setClassFilter(val),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Attendance Quick Actions Bar (All Present, All Absent, Clear All, Save)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              color: AppTheme.background,
              border: Border(bottom: BorderSide(color: AppTheme.border)),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.success,
                      side: const BorderSide(color: AppTheme.success),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
                    label: const Text('All Present', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: records.isEmpty ? null : () => att.markAllStudents('present'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.danger,
                      side: const BorderSide(color: AppTheme.danger),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    icon: const Icon(Icons.highlight_off_rounded, size: 16),
                    label: const Text('All Absent', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: records.isEmpty ? null : () => att.markAllStudents('absent'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.textSecondary,
                      side: const BorderSide(color: AppTheme.border),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    icon: const Icon(Icons.clear_rounded, size: 16),
                    label: const Text('Clear All', style: TextStyle(fontSize: 12)),
                    onPressed: records.isEmpty ? null : () => att.clearAllStudentStatuses(),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    ),
                    icon: att.isSaving
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.save_rounded, size: 16),
                    label: Text(
                      att.hasUnsavedStudentChanges ? 'Save Changes *' : 'Save',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    onPressed: (records.isEmpty || att.isSaving)
                        ? null
                        : () async {
                            final ok = await att.saveStudentAttendance();
                            if (!context.mounted) return;
                            if (ok) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Student attendance saved successfully!'),
                                  backgroundColor: AppTheme.success,
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          },
                  ),
                ],
              ),
            ),
          ),

          // Attendance Summary Pills
          if (summary != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppTheme.surface,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildMiniBadge('Total', summary.total.toString(), AppTheme.textSecondary),
                  _buildMiniBadge('Present', summary.present.toString(), AppTheme.success),
                  _buildMiniBadge('Absent', summary.absent.toString(), AppTheme.danger),
                  _buildMiniBadge('Late', summary.late.toString(), AppTheme.warning),
                  _buildMiniBadge('Half Day', summary.halfDay.toString(), AppTheme.purpleBadge),
                ],
              ),
            ),

          // Student List
          Expanded(
            child: att.isLoading
                ? const Center(child: CircularProgressIndicator())
                : records.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.people_outline_rounded, size: 48, color: AppTheme.textMuted),
                            SizedBox(height: 12),
                            Text('No student attendance records for this date/class.', style: TextStyle(color: AppTheme.textSecondary)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(left: 14, right: 14, top: 12, bottom: 80),
                        itemCount: records.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, idx) {
                          final student = records[idx];
                          final currentStatus = att.getStudentStatus(student);

                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Row(
                                children: [
                                  // Avatar
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor: AppTheme.primaryLight,
                                    child: Text(
                                      student.fullName.isNotEmpty ? student.fullName[0].toUpperCase() : 'S',
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // Student Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          student.fullName,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Adm: ${student.admissionNo ?? "—"} • Roll: ${student.rollNo ?? "—"}',
                                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                        ),
                                        if (student.className != null)
                                          Text(
                                            '${student.className} ${student.section ?? ""}'.trim(),
                                            style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w500),
                                          ),
                                      ],
                                    ),
                                  ),

                                  // 4 Status Pill Options: Present, Absent, Late, Half-Day
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _buildStatusBtn(
                                        label: 'P',
                                        isSelected: currentStatus == 'present',
                                        color: AppTheme.success,
                                        bgColor: AppTheme.successLight,
                                        onTap: () => att.updateStudentStatus(student.id, 'present'),
                                      ),
                                      const SizedBox(width: 4),
                                      _buildStatusBtn(
                                        label: 'A',
                                        isSelected: currentStatus == 'absent',
                                        color: AppTheme.danger,
                                        bgColor: AppTheme.dangerLight,
                                        onTap: () => att.updateStudentStatus(student.id, 'absent'),
                                      ),
                                      const SizedBox(width: 4),
                                      _buildStatusBtn(
                                        label: 'L',
                                        isSelected: currentStatus == 'late',
                                        color: AppTheme.warning,
                                        bgColor: AppTheme.warningLight,
                                        onTap: () => att.updateStudentStatus(student.id, 'late'),
                                      ),
                                      const SizedBox(width: 4),
                                      _buildStatusBtn(
                                        label: 'HD',
                                        isSelected: currentStatus == 'half-day',
                                        color: AppTheme.purpleBadge,
                                        bgColor: AppTheme.purpleBadgeLight,
                                        onTap: () => att.updateStudentStatus(student.id, 'half-day'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBtn({
    required String label,
    required bool isSelected,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected ? color : bgColor,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? color : color.withValues(alpha: 0.3),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : color,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  Widget _buildMiniBadge(String label, String value, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text('$label: ', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}
