import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/leaves_provider.dart';
import 'auth/login_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'attendance/attendance_hub_screen.dart';
import 'attendance/student_attendance_screen.dart';
import 'attendance/staff_attendance_screen.dart';
import 'students/students_screen.dart';
import 'staff/staff_screen.dart';
import 'leaves/leave_approvals_screen.dart';
import 'notices/notices_screen.dart';
import 'settings/settings_screen.dart';
import 'branches/branches_screen.dart';
import 'branches/branch_groups_screen.dart';
import 'admins/admin_users_screen.dart';
import 'academic/academic_data_screen.dart';
import 'academic/academic_groups_screen.dart';
import 'classes/classes_screen.dart';
import 'timetable/timetable_setup_screen.dart';
import 'holidays/holidays_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  static const Color _drawerColor = Color(0xFF0F172A);
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    AttendanceHubScreen(),
    StudentsScreen(),
    StaffScreen(),
    LeaveApprovalsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LeavesProvider>().fetchLeaves();
    });
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log Out'),
        content: const Text(
          'Are you sure you want to log out of your session?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await context.read<AuthProvider>().logout();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _navigateFromDrawer(Widget screen, [int? tabIndex]) {
    Navigator.pop(context); // Close drawer
    if (tabIndex != null) {
      setState(() => _currentIndex = tabIndex);
    } else {
      Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final leaves = context.watch<LeavesProvider>();
    final user = auth.user;
    final org = auth.org;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.school_rounded,
                color: AppTheme.primary,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    org?.name ?? 'School Management',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${user?.name ?? "Admin"} • ${(user?.role ?? "Admin").toUpperCase()}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(
              Icons.campaign_outlined,
              color: AppTheme.textPrimary,
            ),
            tooltip: 'Notices',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const NoticesScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(
              Icons.settings_outlined,
              color: AppTheme.textPrimary,
            ),
            tooltip: 'Settings',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: _drawerColor,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            // User Header
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF111827)),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  (user?.name.isNotEmpty == true ? user!.name[0] : 'A')
                      .toUpperCase(),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary,
                  ),
                ),
              ),
              accountName: Text(
                user?.name ?? 'Administrator',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              accountEmail: Text(
                'Org Code: ${(org?.code ?? "vts").toUpperCase()} • Role: ${user?.role ?? "Admin"}',
                style: const TextStyle(fontSize: 12, color: Colors.white70),
              ),
            ),

            // SECTION 1: OVERVIEW
            _buildSectionHeader('OVERVIEW'),
            _buildDrawerTile(
              Icons.dashboard_rounded,
              '1. Dashboard',
              () => _navigateFromDrawer(const DashboardScreen(), 0),
            ),

            // SECTION 2: ORGANISATION
            _buildSectionHeader('ORGANISATION'),
            _buildDrawerTile(
              Icons.business_rounded,
              '2. Branches',
              () => _navigateFromDrawer(const BranchesScreen()),
            ),
            _buildDrawerTile(
              Icons.workspaces_rounded,
              '3. Branch Groups',
              () => _navigateFromDrawer(const BranchGroupsScreen()),
            ),
            _buildDrawerTile(
              Icons.admin_panel_settings_rounded,
              '4. Admin Users',
              () => _navigateFromDrawer(const AdminUsersScreen()),
            ),
            _buildDrawerTile(
              Icons.settings_rounded,
              '5. Settings',
              () => _navigateFromDrawer(const SettingsScreen()),
            ),

            // SECTION 3: ACADEMIC ADMINISTRATOR
            _buildSectionHeader('ACADEMIC ADMINISTRATOR'),
            _buildDrawerTile(
              Icons.menu_book_rounded,
              '6. Academic Data',
              () => _navigateFromDrawer(const AcademicDataScreen()),
            ),

            // SECTION 4: ACADEMIC
            _buildSectionHeader('ACADEMIC'),
            _buildDrawerTile(
              Icons.category_rounded,
              '7. Academic Groups',
              () => _navigateFromDrawer(const AcademicGroupsScreen()),
            ),
            _buildDrawerTile(
              Icons.meeting_room_rounded,
              '8. Classes & Sections',
              () => _navigateFromDrawer(const ClassesScreen()),
            ),
            _buildDrawerTile(
              Icons.people_alt_rounded,
              '9. Students Directory',
              () => _navigateFromDrawer(const StudentsScreen(), 2),
            ),
            _buildDrawerTile(
              Icons.badge_rounded,
              '10. Staff Directory',
              () => _navigateFromDrawer(const StaffScreen(), 3),
            ),

            // SECTION 5: ATTENDANCE
            _buildSectionHeader('ATTENDANCE'),
            _buildDrawerTile(
              Icons.schedule_rounded,
              '11. Timetable Setup',
              () => _navigateFromDrawer(const TimetableSetupScreen()),
            ),
            _buildDrawerTile(
              Icons.how_to_reg_rounded,
              '12. Student Attendance',
              () => _navigateFromDrawer(const StudentAttendanceScreen(), 1),
            ),
            _buildDrawerTile(
              Icons.access_time_filled_rounded,
              '13. Staff Attendance',
              () => _navigateFromDrawer(const StaffAttendanceScreen()),
            ),

            // SECTION 6: MANAGEMENT
            _buildSectionHeader('MANAGEMENT'),
            _buildDrawerTile(
              Icons.beach_access_rounded,
              '14. Leave Management',
              () => _navigateFromDrawer(const LeaveApprovalsScreen(), 4),
              badgeCount: leaves.pendingCount,
            ),
            _buildDrawerTile(
              Icons.calendar_month_rounded,
              '15. Holidays Calendar',
              () => _navigateFromDrawer(const HolidaysScreen()),
            ),
            _buildDrawerTile(
              Icons.campaign_rounded,
              '16. Notices & Circulars',
              () => _navigateFromDrawer(const NoticesScreen()),
            ),

            const Divider(height: 24, color: Color(0xFF334155)),
            ListTile(
              leading: const Icon(
                Icons.logout_rounded,
                color: Color(0xFFF87171),
              ),
              title: const Text(
                'Log Out',
                style: TextStyle(
                  color: Color(0xFFF87171),
                  fontWeight: FontWeight.bold,
                ),
              ),
              onTap: () {
                Navigator.pop(context);
                _handleLogout();
              },
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard_rounded),
            label: 'Dashboard',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.event_available_outlined),
            activeIcon: Icon(Icons.event_available_rounded),
            label: 'Attendance',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.people_outline_rounded),
            activeIcon: Icon(Icons.people_alt_rounded),
            label: 'Students',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.badge_outlined),
            activeIcon: Icon(Icons.badge_rounded),
            label: 'Staff',
          ),
          BottomNavigationBarItem(
            icon: leaves.pendingCount > 0
                ? Badge(
                    label: Text('${leaves.pendingCount}'),
                    child: const Icon(Icons.beach_access_outlined),
                  )
                : const Icon(Icons.beach_access_outlined),
            activeIcon: leaves.pendingCount > 0
                ? Badge(
                    label: Text('${leaves.pendingCount}'),
                    child: const Icon(Icons.beach_access_rounded),
                  )
                : const Icon(Icons.beach_access_rounded),
            label: 'Leaves',
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, top: 12, bottom: 4),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: Color(0xFF94A3B8),
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildDrawerTile(
    IconData icon,
    String title,
    VoidCallback onTap, {
    int? badgeCount,
  }) {
    return ListTile(
      dense: true,
      leading: Icon(icon, color: const Color(0xFFA5B4FC), size: 20),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
      trailing: badgeCount != null && badgeCount > 0
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppTheme.danger,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$badgeCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
          : null,
      onTap: onTap,
    );
  }
}
