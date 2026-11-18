import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import 'student_attendance_screen.dart';
import 'staff_attendance_screen.dart';
import 'face_scanner_screen.dart';

class AttendanceHubScreen extends StatefulWidget {
  const AttendanceHubScreen({super.key});

  @override
  State<AttendanceHubScreen> createState() => _AttendanceHubScreenState();
}

class _AttendanceHubScreenState extends State<AttendanceHubScreen> with SingleTickerProviderStateMixin {
  TabController? _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tabCtrl = _tabController ?? TabController(length: 2, vsync: this);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: Navigator.canPop(context) ? const CustomAppBar() : null,
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.only(left: 16, right: 16, top: 14),
            child: const PageHeaderTitle(
              title: 'Attendance Hub',
              subtitle: 'Track real-time daily attendance for students and staff across all branches',
            ),
          ),
          Container(
            color: AppTheme.surface,
            child: TabBar(
              controller: tabCtrl,
              indicatorColor: AppTheme.primary,
              indicatorWeight: 3,
              labelColor: AppTheme.primary,
              unselectedLabelColor: AppTheme.textSecondary,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              tabs: const [
                Tab(
                  iconMargin: EdgeInsets.zero,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.school_rounded, size: 18),
                      SizedBox(width: 8),
                      Text('Student Attendance'),
                    ],
                  ),
                ),
                Tab(
                  iconMargin: EdgeInsets.zero,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.badge_rounded, size: 18),
                      SizedBox(width: 8),
                      Text('Staff Attendance'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: tabCtrl,
              children: const [
                StudentAttendanceScreen(),
                StaffAttendanceScreen(),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const FaceScannerScreen()),
          );
        },
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.camera_alt_rounded, color: Colors.white),
        label: const Text(
          'Face Scan',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

