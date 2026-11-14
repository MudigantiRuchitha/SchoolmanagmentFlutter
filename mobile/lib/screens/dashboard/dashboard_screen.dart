import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/dashboard_provider.dart';
import '../../providers/auth_provider.dart';

import '../branches/branches_screen.dart';
import '../branches/branch_groups_screen.dart';
import '../admins/admin_users_screen.dart';
import '../settings/settings_screen.dart';
import '../academic/academic_data_screen.dart';
import '../academic/academic_groups_screen.dart';
import '../classes/classes_screen.dart';
import '../students/students_screen.dart';
import '../staff/staff_screen.dart';
import '../timetable/timetable_setup_screen.dart';
import '../attendance/student_attendance_screen.dart';
import '../attendance/staff_attendance_screen.dart';
import '../leaves/leave_approvals_screen.dart';
import '../holidays/holidays_screen.dart';
import '../notices/notices_screen.dart';
import '../attendance/face_scanner_screen.dart';

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
          // Greeting & Institution Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E3A8A), Color(0xFF2563EB)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          (org?.code ?? 'VTS').toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Welcome back, ${user?.name.split(" ").first ?? "Admin"}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 19,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        org?.name ?? 'School Management Portal',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton.filled(
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.25),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 28),
                  tooltip: 'Face Biometric Scanner',
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const FaceScannerScreen()),
                    );
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

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
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentsScreen())),
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
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StaffScreen())),
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
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ClassesScreen())),
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
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BranchesScreen())),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // =========================================================
          // ALL 16 WEB MANAGEMENT MODULES (GRID)
          // =========================================================
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'All 16 School Modules',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
              ),
              Text(
                'Connected to Live DB',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.success),
              ),
            ],
          ),
          const SizedBox(height: 12),

          GridView.count(
            crossAxisCount: 4,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              // 1. Dashboard
              _buildModuleIcon(Icons.dashboard_rounded, 'Dashboard', AppTheme.primary, () {}),
              // 2. Branches
              _buildModuleIcon(Icons.business_rounded, 'Branches', const Color(0xFF0284C7), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BranchesScreen()))),
              // 3. Branch Groups
              _buildModuleIcon(Icons.workspaces_rounded, 'Branch Grp', const Color(0xFF0D9488), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BranchGroupsScreen()))),
              // 4. Admin Users
              _buildModuleIcon(Icons.admin_panel_settings_rounded, 'Admins', const Color(0xFF4F46E5), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminUsersScreen()))),
              // 5. Settings
              _buildModuleIcon(Icons.settings_rounded, 'Settings', const Color(0xFF64748B), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()))),
              // 6. Academic Data
              _buildModuleIcon(Icons.menu_book_rounded, 'Acad Data', const Color(0xFF7C3AED), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AcademicDataScreen()))),
              // 7. Academic Groups
              _buildModuleIcon(Icons.category_rounded, 'Acad Groups', const Color(0xFF9333EA), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AcademicGroupsScreen()))),
              // 8. Classes
              _buildModuleIcon(Icons.school_rounded, 'Classes', const Color(0xFFD97706), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ClassesScreen()))),
              // 9. Staff
              _buildModuleIcon(Icons.badge_rounded, 'Staff', const Color(0xFF2563EB), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StaffScreen()))),
              // 10. Students
              _buildModuleIcon(Icons.people_alt_rounded, 'Students', const Color(0xFF059669), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentsScreen()))),
              // 11. Timetable Setup
              _buildModuleIcon(Icons.schedule_rounded, 'Timetable', const Color(0xFFE11D48), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TimetableSetupScreen()))),
              // 12. Student Attendance
              _buildModuleIcon(Icons.how_to_reg_rounded, 'Student Att', const Color(0xFF16A34A), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentAttendanceScreen()))),
              // 13. Staff Attendance
              _buildModuleIcon(Icons.access_time_filled_rounded, 'Staff Att', const Color(0xFFEA580C), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StaffAttendanceScreen()))),
              // 14. Leave Management
              _buildModuleIcon(Icons.beach_access_rounded, 'Leaves', const Color(0xFF0284C7), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LeaveApprovalsScreen()))),
              // 15. Holidays
              _buildModuleIcon(Icons.calendar_month_rounded, 'Holidays', const Color(0xFFF59E0B), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HolidaysScreen()))),
              // 16. Notices
              _buildModuleIcon(Icons.campaign_rounded, 'Notices', const Color(0xFF8B5CF6), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NoticesScreen()))),
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
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
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
                      Icon(Icons.campaign_outlined, color: AppTheme.textMuted, size: 36),
                      SizedBox(height: 8),
                      Text('No recent notices found', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            )
          else
            ...dash.recentNotices.take(3).map((notice) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    leading: CircleAvatar(
                      backgroundColor: notice.isImportant ? AppTheme.dangerLight : AppTheme.primaryLight,
                      child: Icon(
                        Icons.campaign_rounded,
                        color: notice.isImportant ? AppTheme.danger : AppTheme.primary,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      notice.title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textPrimary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      notice.content,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                    trailing: notice.isImportant
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.dangerLight,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text('Urgent', style: TextStyle(color: AppTheme.danger, fontSize: 10, fontWeight: FontWeight.bold)),
                          )
                        : null,
                  ),
                )),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildModuleIcon(IconData icon, String label, Color color, VoidCallback onTap) {
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
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
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
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                ),
                const Spacer(),
                Text(
                  '${pct.toStringAsFixed(0)}% Present',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.success),
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
                valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.success),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatPill('Total', total.toString(), AppTheme.textSecondary),
                _buildStatPill('Present', present.toString(), AppTheme.success),
                _buildStatPill('Absent', absent.toString(), AppTheme.danger),
                _buildStatPill('Late', late.toString(), AppTheme.warning),
                _buildStatPill('Half Day', halfDay.toString(), AppTheme.purpleBadge),
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
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
        ),
      ],
    );
  }
}
