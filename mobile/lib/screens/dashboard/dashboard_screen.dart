import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../providers/dashboard_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/admin_ui.dart';
import '../branches/branches_screen.dart';
import '../classes/classes_screen.dart';
import '../students/students_screen.dart';
import '../staff/staff_screen.dart';
import '../timetable/timetable_setup_screen.dart';
import '../attendance/student_attendance_screen.dart';
import '../attendance/staff_attendance_screen.dart';
import '../notices/notices_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DashboardProvider>().fetchDashboardData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final dash = context.watch<DashboardProvider>();
    final auth = context.watch<AuthProvider>();
    final stats = dash.stats;
    final stuSummary = dash.studentSummary;
    final stfSummary = dash.staffSummary;
    final user = auth.user;
    final org = auth.org;

    return RefreshIndicator(
      onRefresh: () => dash.fetchDashboardData(),
      color: AppTheme.primary,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          AdminPageHeading(
            title: 'Dashboard',
            subtitle:
                'Welcome back, ${user?.name.split(" ").first ?? "Admin"} • ${org?.name ?? "School Management"}',
            horizontalPadding: 0,
          ),

          // 4 Key KPI Metrics Cards (Row 1)
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Students',
                  value: stats?.totalStudents.toString() ?? '—',
                  icon: Icons.people_alt_rounded,
                  color: AppTheme.primary,
                  bgColor: AppTheme.primaryLight,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const StudentsScreen()),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKpiCard(
                  label: 'Staff',
                  value: stats?.totalStaff.toString() ?? '—',
                  icon: Icons.badge_rounded,
                  color: AppTheme.secondary,
                  bgColor: AppTheme.secondaryLight,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const StaffScreen()),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // (Row 2)
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Classes',
                  value: stats?.totalClasses.toString() ?? '—',
                  icon: Icons.meeting_room_rounded,
                  color: AppTheme.warning,
                  bgColor: AppTheme.warningLight,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ClassesScreen()),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKpiCard(
                  label: 'Branches',
                  value: stats?.totalBranches.toString() ?? '—',
                  icon: Icons.account_tree_rounded,
                  color: AppTheme.success,
                  bgColor: AppTheme.successLight,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const BranchesScreen()),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          const SizedBox(height: 24),
          const Text(
            'Quick Access',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildModuleIcon(
                  Icons.how_to_reg_rounded,
                  'Student Att.',
                  AppTheme.success,
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const StudentAttendanceScreen(),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildModuleIcon(
                  Icons.access_time_filled_rounded,
                  'Staff Att.',
                  AppTheme.secondary,
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const StaffAttendanceScreen(),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildModuleIcon(
                  Icons.schedule_rounded,
                  'Timetable',
                  AppTheme.warning,
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TimetableSetupScreen(),
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Today's Student Attendance Card
          _buildAttendanceCard(
            title: "Today's Student Attendance",
            icon: Icons.people_alt_rounded,
            summary: stuSummary,
          ),

          const SizedBox(height: 16),

          // Today's Staff Attendance Card
          _buildAttendanceCard(
            title: "Today's Staff Attendance",
            icon: Icons.badge_rounded,
            summary: stfSummary,
          ),

          const SizedBox(height: 24),

          // Recent Notices Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recent Notices',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NoticesScreen()),
                  );
                },
                child: const Text('View All'),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (dash.recentNotices.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.campaign_outlined,
                        color: AppTheme.textMuted,
                        size: 36,
                      ),
                      SizedBox(height: 8),
                      Text(
                        'No recent notices found',
                        style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            ...dash.recentNotices
                .take(3)
                .map(
                  (notice) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 4,
                      ),
                      leading: CircleAvatar(
                        backgroundColor: notice.isImportant
                            ? AppTheme.dangerLight
                            : AppTheme.primaryLight,
                        child: Icon(
                          Icons.campaign_rounded,
                          color: notice.isImportant
                              ? AppTheme.danger
                              : AppTheme.primary,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        notice.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: AppTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        notice.content,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      trailing: notice.isImportant
                          ? Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.dangerLight,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'Urgent',
                                style: TextStyle(
                                  color: AppTheme.danger,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            )
                          : null,
                    ),
                  ),
                ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildModuleIcon(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.border),
        ),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
    required Color bgColor,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: color,
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppTheme.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAttendanceCard({
    required String title,
    required IconData icon,
    required dynamic summary,
  }) {
    final total = summary?.total ?? 0;
    final present = summary?.present ?? 0;
    final absent = summary?.absent ?? 0;
    final late = summary?.late ?? 0;
    final halfDay = summary?.halfDay ?? 0;
    final pct = total > 0 ? (present / total) * 100 : 0.0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppTheme.primary, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const Spacer(),
                Text(
                  '${pct.toStringAsFixed(0)}% Present',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: total > 0 ? (present / total).clamp(0.0, 1.0) : 0,
                minHeight: 8,
                backgroundColor: AppTheme.border,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppTheme.success,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatPill(
                  'Total',
                  total.toString(),
                  AppTheme.textSecondary,
                ),
                _buildStatPill('Present', present.toString(), AppTheme.success),
                _buildStatPill('Absent', absent.toString(), AppTheme.danger),
                _buildStatPill('Late', late.toString(), AppTheme.warning),
                _buildStatPill(
                  'Half Day',
                  halfDay.toString(),
                  AppTheme.purpleBadge,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatPill(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
        ),
      ],
    );
  }
}
