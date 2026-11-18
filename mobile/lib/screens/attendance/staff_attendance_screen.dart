import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../models/attendance_model.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/students_provider.dart';
import '../../widgets/custom_app_bar.dart';

class StaffAttendanceScreen extends StatefulWidget {
  const StaffAttendanceScreen({super.key});

  @override
  State<StaffAttendanceScreen> createState() => _StaffAttendanceScreenState();
}

class _StaffAttendanceScreenState extends State<StaffAttendanceScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<StudentsProvider>().initFilters();
      context.read<AttendanceProvider>().fetchStaffAttendance();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _pickDate() async {
    final att = context.read<AttendanceProvider>();
    final picked = await showDatePicker(
      context: context,
      initialDate: att.selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) att.setDate(picked);
  }

  String _formatTime12(String? timeStr) {
    if (timeStr == null || timeStr.trim().isEmpty) return '—';
    try {
      final clean = timeStr.trim().split('.')[0];
      final parts = clean.split(':');
      final h = int.parse(parts[0]);
      final m = parts.length > 1 ? parts[1] : '00';
      final ampm = h >= 12 ? 'PM' : 'AM';
      final formattedHour = h % 12 == 0 ? 12 : h % 12;
      return '$formattedHour:$m $ampm';
    } catch (_) {
      return timeStr;
    }
  }

  void _showPunchesModal(StaffAttendanceRecord staff) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.fingerprint_rounded,
                  color: AppTheme.secondary,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        staff.fullName,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        'Staff ID: ${staff.staffId ?? "—"} • Role: ${staff.roleType}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Expected Hours: ${_formatTime12(staff.expectedCheckIn)} – ${_formatTime12(staff.expectedCheckOut)}',
              style: const TextStyle(
                fontSize: 13,
                color: AppTheme.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Biometric & Device Punch Logs:',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            if (staff.punches.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text(
                    'No biometric punches logged for this date.',
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ),
              )
            else
              ...staff.punches.map(
                (p) => Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.background,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _formatTime12(p.time),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.secondaryLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          p.mode?.toUpperCase() ?? 'DEVICE',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppTheme.secondary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final students = context.watch<StudentsProvider>();
    final records = att.staffRecords;
    final summary = att.staffSummary;
    final visibleRecords = records.where((staff) {
      final query = _searchController.text.trim().toLowerCase();
      final matchesSearch =
          query.isEmpty ||
          '${staff.fullName} ${staff.staffId ?? ''} ${staff.designation ?? ''}'
              .toLowerCase()
              .contains(query);
      final status = att.getStaffStatus(staff);
      final matchesStatus =
          _statusFilter == 'all' ||
          (_statusFilter == 'not_marked'
              ? status.isEmpty
              : status == _statusFilter);
      return matchesSearch && matchesStatus;
    }).toList();

    final body = RefreshIndicator(
        onRefresh: () => att.fetchStaffAttendance(),
        color: AppTheme.primary,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
              color: AppTheme.surface,
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.filter_list_rounded,
                        color: AppTheme.primary,
                        size: 19,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Staff School Timings',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        onPressed: () => att.setDate(
                          att.selectedDate.subtract(const Duration(days: 1)),
                        ),
                        icon: const Icon(Icons.chevron_left_rounded),
                        tooltip: 'Previous day',
                      ),
                      TextButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(
                          Icons.calendar_today_rounded,
                          size: 15,
                        ),
                        label: Text(
                          DateFormat('dd MMM yyyy').format(att.selectedDate),
                        ),
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        onPressed: () => att.setDate(
                          att.selectedDate.add(const Duration(days: 1)),
                        ),
                        icon: const Icon(Icons.chevron_right_rounded),
                        tooltip: 'Next day',
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<int?>(
                          initialValue: att.selectedBranchId,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 8,
                            ),
                            labelText: 'Branch',
                            prefixIcon: Icon(Icons.business_outlined, size: 17),
                          ),
                          isExpanded: true,
                          items: [
                            const DropdownMenuItem<int?>(
                              value: null,
                              child: Text('All Branches'),
                            ),
                            ...students.branches.map((branch) {
                              final id = branch['id'] is int
                                  ? branch['id']
                                  : int.tryParse(branch['id'].toString());
                              return DropdownMenuItem<int?>(
                                value: id,
                                child: Text(
                                  branch['name']?.toString() ?? 'Branch',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }),
                          ],
                          onChanged: (value) => att.setBranchFilter(value),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String?>(
                          initialValue: att.selectedRoleType,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 8,
                            ),
                            labelText: 'Role',
                            prefixIcon: Icon(Icons.badge_outlined, size: 17),
                          ),
                          isExpanded: true,
                          items: const [
                            DropdownMenuItem(
                              value: null,
                              child: Text('All Roles'),
                            ),
                            DropdownMenuItem(
                              value: 'teaching',
                              child: Text('Teaching'),
                            ),
                            DropdownMenuItem(
                              value: 'non-teaching',
                              child: Text('Non-Teaching'),
                            ),
                            DropdownMenuItem(
                              value: 'management',
                              child: Text('Management'),
                            ),
                          ],
                          onChanged: (value) => att.setRoleFilter(value),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          decoration: InputDecoration(
                            hintText: 'Search staff...',
                            prefixIcon: const Icon(
                              Icons.search_rounded,
                              size: 19,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                            suffixIcon: _searchController.text.isEmpty
                                ? null
                                : IconButton(
                                    icon: const Icon(
                                      Icons.clear_rounded,
                                      size: 17,
                                    ),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() {});
                                    },
                                  ),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _statusFilter,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 8,
                            ),
                            labelText: 'Attendance status',
                            prefixIcon: Icon(
                              Icons.fact_check_outlined,
                              size: 17,
                            ),
                          ),
                          isExpanded: true,
                          items: const [
                            DropdownMenuItem(
                              value: 'all',
                              child: Text('All Statuses'),
                            ),
                            DropdownMenuItem(
                              value: 'present',
                              child: Text('Present'),
                            ),
                            DropdownMenuItem(
                              value: 'absent',
                              child: Text('Absent'),
                            ),
                            DropdownMenuItem(
                              value: 'late',
                              child: Text('Late'),
                            ),
                            DropdownMenuItem(
                              value: 'half-day',
                              child: Text('Half Day'),
                            ),
                            DropdownMenuItem(
                              value: 'not_marked',
                              child: Text('Not Marked'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _statusFilter = value);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: records.isEmpty
                        ? null
                        : () => att.markAllStaff('present'),
                    icon: const Icon(
                      Icons.check_circle_outline_rounded,
                      size: 16,
                    ),
                    label: const Text('All Present'),
                  ),
                  const SizedBox(width: 6),
                  OutlinedButton.icon(
                    onPressed: records.isEmpty
                        ? null
                        : () => att.markAllStaff('absent'),
                    icon: const Icon(Icons.highlight_off_rounded, size: 16),
                    label: const Text('All Absent'),
                  ),
                  const SizedBox(width: 6),
                  OutlinedButton.icon(
                    onPressed: records.isEmpty
                        ? null
                        : () => att.markAllStaff(''),
                    icon: const Icon(Icons.clear_rounded, size: 16),
                    label: const Text('Clear'),
                  ),
                  const SizedBox(width: 6),
                  ElevatedButton.icon(
                    icon: att.isSaving
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.save_rounded, size: 16),
                    label: Text(att.hasUnsavedStaffChanges ? 'Save *' : 'Save'),
                    onPressed: (records.isEmpty || att.isSaving)
                        ? null
                        : () async {
                            final ok = await att.saveStaffAttendance();
                            if (!context.mounted) return;
                            if (ok) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Staff attendance saved successfully!',
                                  ),
                                  backgroundColor: AppTheme.success,
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            } else if (att.errorMessage != null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(att.errorMessage!),
                                  backgroundColor: AppTheme.danger,
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          },
                  ),
                ],
              ),
            ),

            // Summary Badges
            if (summary != null)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                color: AppTheme.surface,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildMiniBadge(
                        'Total',
                        summary.total.toString(),
                        AppTheme.textSecondary,
                      ),
                      const SizedBox(width: 14),
                      _buildMiniBadge(
                        'Present',
                        summary.present.toString(),
                        AppTheme.success,
                      ),
                      const SizedBox(width: 14),
                      _buildMiniBadge(
                        'Absent',
                        summary.absent.toString(),
                        AppTheme.danger,
                      ),
                      const SizedBox(width: 14),
                      _buildMiniBadge(
                        'Late',
                        summary.late.toString(),
                        AppTheme.warning,
                      ),
                      const SizedBox(width: 14),
                      _buildMiniBadge(
                        'Half Day',
                        summary.halfDay.toString(),
                        AppTheme.purpleBadge,
                      ),
                    ],
                  ),
                ),
              ),

            // Staff Records List
            Expanded(
              child: att.isStaffLoading
                  ? const Center(child: CircularProgressIndicator())
                  : att.staffErrorMessage != null
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
                              'Could not load staff attendance.',
                              style: TextStyle(fontWeight: FontWeight.w700),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              att.staffErrorMessage!,
                              style: const TextStyle(
                                color: AppTheme.textSecondary,
                                fontSize: 12,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 10),
                            OutlinedButton.icon(
                              onPressed: () => att.fetchStaffAttendance(),
                              icon: const Icon(Icons.refresh_rounded),
                              label: const Text('Try again'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : visibleRecords.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.badge_outlined,
                            size: 48,
                            color: AppTheme.textMuted,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No staff records match these filters.',
                            style: TextStyle(color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.only(
                        left: 14,
                        right: 14,
                        top: 12,
                        bottom: 80,
                      ),
                      itemCount: visibleRecords.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (ctx, idx) {
                        final staff = visibleRecords[idx];
                        final currentStatus = att.getStaffStatus(staff);

                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Staff Header
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    CircleAvatar(
                                      radius: 20,
                                      backgroundColor: AppTheme.secondaryLight,
                                      child: Text(
                                        staff.fullName.isNotEmpty
                                            ? staff.fullName[0].toUpperCase()
                                            : 'S',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.secondary,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            staff.fullName,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            'ID: ${staff.staffId ?? "—"} • ${staff.designation ?? staff.roleType}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.textSecondary,
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            '${staff.branchName ?? "All Branches"} • ${_formatTime12(staff.expectedCheckIn)}–${_formatTime12(staff.expectedCheckOut)}',
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppTheme.textMuted,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(
                                        Icons.fingerprint_rounded,
                                        color: AppTheme.secondary,
                                        size: 22,
                                      ),
                                      tooltip: 'View Punches',
                                      onPressed: () => _showPunchesModal(staff),
                                    ),
                                  ],
                                ),

                                const Divider(height: 16),

                                // Timings Row
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'CHECK IN',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.textSecondary,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Row(
                                            children: [
                                              Text(
                                                _formatTime12(staff.checkIn),
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                ),
                                              ),
                                              if (currentStatus == 'late' ||
                                                  (staff.checkIn != null &&
                                                      staff.checkIn!.compareTo(
                                                            '09:15',
                                                          ) >
                                                          0)) ...[
                                                const SizedBox(width: 6),
                                                Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 5,
                                                        vertical: 2,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    color:
                                                        AppTheme.warningLight,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          4,
                                                        ),
                                                  ),
                                                  child: const Text(
                                                    'Late',
                                                    style: TextStyle(
                                                      color: AppTheme.warning,
                                                      fontSize: 9,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          Text(
                                            'Exp: ${_formatTime12(staff.expectedCheckIn)}',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppTheme.textMuted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'CHECK OUT',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.textSecondary,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            _formatTime12(staff.checkOut),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13,
                                            ),
                                          ),
                                          Text(
                                            'Exp: ${_formatTime12(staff.expectedCheckOut)}',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppTheme.textMuted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),

                                const SizedBox(height: 12),

                                // Status Selection Pills (P, A, L, HD)
                                Row(
                                  children: [
                                    const Text(
                                      'Status: ',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.textSecondary,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Row(
                                        children: [
                                          _buildStaffStatusBtn(
                                            'Present',
                                            currentStatus == 'present',
                                            AppTheme.success,
                                            () => att.updateStaffStatus(
                                              staff.id,
                                              'present',
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          _buildStaffStatusBtn(
                                            'Absent',
                                            currentStatus == 'absent',
                                            AppTheme.danger,
                                            () => att.updateStaffStatus(
                                              staff.id,
                                              'absent',
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          _buildStaffStatusBtn(
                                            'Late',
                                            currentStatus == 'late',
                                            AppTheme.warning,
                                            () => att.updateStaffStatus(
                                              staff.id,
                                              'late',
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          _buildStaffStatusBtn(
                                            'Half Day',
                                            currentStatus == 'half-day',
                                            AppTheme.purpleBadge,
                                            () => att.updateStaffStatus(
                                              staff.id,
                                              'half-day',
                                            ),
                                          ),
                                        ],
                                      ),
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

    if (Navigator.canPop(context)) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: const CustomAppBar(),
        body: body,
      );
    }
    return Material(
      color: Colors.transparent,
      child: body,
    );
  }

  Widget _buildStaffStatusBtn(
    String label,
    bool isSelected,
    Color color,
    VoidCallback onTap,
  ) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? color : color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: isSelected ? color : color.withValues(alpha: 0.2),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : color,
            ),
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
        Text(
          '$label: ',
          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }
}
