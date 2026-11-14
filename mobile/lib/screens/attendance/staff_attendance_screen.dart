import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../models/attendance_model.dart';
import '../../providers/attendance_provider.dart';

class StaffAttendanceScreen extends StatefulWidget {
  const StaffAttendanceScreen({super.key});

  @override
  State<StaffAttendanceScreen> createState() => _StaffAttendanceScreenState();
}

class _StaffAttendanceScreenState extends State<StaffAttendanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AttendanceProvider>().fetchStaffAttendance();
    });
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
                const Icon(Icons.fingerprint_rounded, color: AppTheme.secondary, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        staff.fullName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      Text(
                        'Staff ID: ${staff.staffId ?? "—"} • Role: ${staff.roleType}',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Expected Hours: ${_formatTime12(staff.expectedCheckIn)} – ${_formatTime12(staff.expectedCheckOut)}',
              style: const TextStyle(fontSize: 13, color: AppTheme.primary, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            const Text(
              'Biometric & Device Punch Logs:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 8),
            if (staff.punches.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text(
                    'No biometric punches logged for this date.',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ),
              )
            else
              ...staff.punches.map(
                (p) => Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                        style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.secondaryLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          p.mode?.toUpperCase() ?? 'DEVICE',
                          style: const TextStyle(fontSize: 10, color: AppTheme.secondary, fontWeight: FontWeight.bold),
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
    final records = att.staffRecords;
    final summary = att.staffSummary;

    return RefreshIndicator(
      onRefresh: () => att.fetchStaffAttendance(),
      color: AppTheme.primary,
      child: Column(
        children: [
          // Filter Toolbar (Role Filter)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppTheme.surface,
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: att.selectedRoleType,
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      prefixIcon: Icon(Icons.filter_list_rounded, size: 18),
                    ),
                    hint: const Text('All Roles (Teaching & Non-Teaching)', style: TextStyle(fontSize: 13)),
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: null, child: Text('All Staff Roles', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'teaching', child: Text('Teaching Staff', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'non-teaching', child: Text('Non-Teaching Staff', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'management', child: Text('Management', style: TextStyle(fontSize: 13))),
                    ],
                    onChanged: (val) => att.setRoleFilter(val),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  icon: att.isSaving
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.save_rounded, size: 16),
                  label: Text(att.hasUnsavedStaffChanges ? 'Save *' : 'Save', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  onPressed: (records.isEmpty || att.isSaving)
                      ? null
                      : () async {
                          final ok = await att.saveStaffAttendance();
                          if (!context.mounted) return;
                          if (ok) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Staff attendance saved successfully!'),
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

          // Summary Badges
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

          // Staff Records List
          Expanded(
            child: att.isLoading
                ? const Center(child: CircularProgressIndicator())
                : records.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.badge_outlined, size: 48, color: AppTheme.textMuted),
                            SizedBox(height: 12),
                            Text('No staff records found for this date/filter.', style: TextStyle(color: AppTheme.textSecondary)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(left: 14, right: 14, top: 12, bottom: 80),
                        itemCount: records.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, idx) {
                          final staff = records[idx];
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
                                          staff.fullName.isNotEmpty ? staff.fullName[0].toUpperCase() : 'S',
                                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.secondary),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              staff.fullName,
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'ID: ${staff.staffId ?? "—"} • ${staff.designation ?? staff.roleType}',
                                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                            ),
                                          ],
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.fingerprint_rounded, color: AppTheme.secondary, size: 22),
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
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text('CHECK IN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                                            const SizedBox(height: 2),
                                            Row(
                                              children: [
                                                Text(
                                                  _formatTime12(staff.checkIn),
                                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                                ),
                                                if (staff.status == 'late' || (staff.checkIn != null && staff.checkIn!.compareTo('09:15') > 0)) ...[
                                                  const SizedBox(width: 6),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                    decoration: BoxDecoration(color: AppTheme.warningLight, borderRadius: BorderRadius.circular(4)),
                                                    child: const Text('Late', style: TextStyle(color: AppTheme.warning, fontSize: 9, fontWeight: FontWeight.bold)),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            Text('Exp: ${_formatTime12(staff.expectedCheckIn)}', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text('CHECK OUT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                                            const SizedBox(height: 2),
                                            Text(
                                              _formatTime12(staff.checkOut),
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                            ),
                                            Text('Exp: ${_formatTime12(staff.expectedCheckOut)}', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),

                                  const SizedBox(height: 12),

                                  // Status Selection Pills (P, A, L, HD)
                                  Row(
                                    children: [
                                      const Text('Status: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary)),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Row(
                                          children: [
                                            _buildStaffStatusBtn('Present', currentStatus == 'present', AppTheme.success, () => att.updateStaffStatus(staff.id, 'present')),
                                            const SizedBox(width: 6),
                                            _buildStaffStatusBtn('Absent', currentStatus == 'absent', AppTheme.danger, () => att.updateStaffStatus(staff.id, 'absent')),
                                            const SizedBox(width: 6),
                                            _buildStaffStatusBtn('Late', currentStatus == 'late', AppTheme.warning, () => att.updateStaffStatus(staff.id, 'late')),
                                            const SizedBox(width: 6),
                                            _buildStaffStatusBtn('Half Day', currentStatus == 'half-day', AppTheme.purpleBadge, () => att.updateStaffStatus(staff.id, 'half-day')),
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
  }

  Widget _buildStaffStatusBtn(String label, bool isSelected, Color color, VoidCallback onTap) {
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
            border: Border.all(color: isSelected ? color : color.withValues(alpha: 0.2)),
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
        Text('$label: ', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}
