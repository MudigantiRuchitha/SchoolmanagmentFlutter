import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../providers/dashboard_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../branches/branches_screen.dart';
import '../admins/admin_users_screen.dart';
import '../classes/classes_screen.dart';
import '../students/students_screen.dart';
import '../staff/staff_screen.dart';
import '../notices/notices_screen.dart';
import '../settings/settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<Color> _avatarColors = const [
    Color(0xFF6366F1), // Indigo
    Color(0xFF8B5CF6), // Purple
    Color(0xFF3B82F6), // Blue
    Color(0xFF0D9488), // Teal
    Color(0xFFD97706), // Amber
    Color(0xFFE11D48), // Rose
    Color(0xFF10B981), // Emerald
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DashboardProvider>().fetchDashboardData();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Color _getAvatarColor(String name) {
    if (name.isEmpty) return _avatarColors[0];
    final hash = name.codeUnits.fold(0, (acc, c) => acc + c);
    return _avatarColors[hash % _avatarColors.length];
  }

  Future<void> _pickDate(BuildContext context, DashboardProvider dash) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: dash.selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      builder: (ctx, child) {
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF4F46E5),
              onPrimary: Colors.white,
              onSurface: Color(0xFF1E293B),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      dash.setSelectedDate(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dash = context.watch<DashboardProvider>();
    final auth = context.watch<AuthProvider>();
    final stats = dash.stats;
    final user = auth.user;

    final todayFormatted = DateFormat('EEEE, MMMM d yyyy').format(DateTime.now());

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: Navigator.canPop(context) ? const CustomAppBar() : null,
      body: RefreshIndicator(
        onRefresh: () => dash.fetchDashboardData(),
        color: const Color(0xFF4F46E5),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 980;

            return ListView(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              children: [
                // =========================================================
                // 1. PAGE TITLE & SUBTITLE
                // =========================================================
                PageHeaderTitle(
                  title: 'Dashboard',
                  subtitle: 'Today: $todayFormatted',
                ),

                // =========================================================
                // 2. 8 STATS KPI CARDS
                // =========================================================
                _buildStatsGrid(stats, constraints.maxWidth),
                const SizedBox(height: 20),

                // =========================================================
                // 3. MAIN CONTENT: ATTENDANCE & SIDE SUMMARY
                // =========================================================
                if (isWide)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Left Column (Attendance Card)
                      Expanded(
                        flex: 68,
                        child: _buildAttendanceCard(dash),
                      ),
                      const SizedBox(width: 18),
                      // Right Column (Attendance Summary + Recent Notices)
                      Expanded(
                        flex: 32,
                        child: Column(
                          children: [
                            _buildAttendanceSummaryCard(dash),
                            const SizedBox(height: 18),
                            _buildRecentNoticesCard(dash),
                          ],
                        ),
                      ),
                    ],
                  )
                else
                  Column(
                    children: [
                      _buildAttendanceCard(dash),
                      const SizedBox(height: 18),
                      _buildAttendanceSummaryCard(dash),
                      const SizedBox(height: 18),
                      _buildRecentNoticesCard(dash),
                    ],
                  ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }

  // =========================================================================
  // 8 STATS CARDS GRID
  // =========================================================================
  Widget _buildStatsGrid(dynamic stats, double screenWidth) {
    final cards = [
      _StatData(
        label: 'Total Students',
        value: stats?.totalStudents.toString() ?? '—',
        icon: Icons.school_rounded,
        color: const Color(0xFF2563EB),
        bgColor: const Color(0xFFEFF6FF),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentsScreen())),
      ),
      _StatData(
        label: 'Teaching Staff',
        value: stats?.teachingStaff.toString() ?? '—',
        icon: Icons.groups_rounded,
        color: const Color(0xFF10B981),
        bgColor: const Color(0xFFECFDF5),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const StaffScreen(initialRole: 'teaching'),
          ),
        ),
      ),
      _StatData(
        label: 'Non-Teaching',
        value: stats?.nonTeachingStaff.toString() ?? '—',
        icon: Icons.person_rounded,
        color: const Color(0xFFF59E0B),
        bgColor: const Color(0xFFFFFBEB),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const StaffScreen(initialRole: 'non-teaching'),
          ),
        ),
      ),
      _StatData(
        label: 'Management',
        value: stats?.managementStaff.toString() ?? '—',
        icon: Icons.admin_panel_settings_rounded,
        color: const Color(0xFF8B5CF6),
        bgColor: const Color(0xFFF5F3FF),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const StaffScreen(initialRole: 'management'),
          ),
        ),
      ),
      _StatData(
        label: 'Total Staff',
        value: stats?.totalStaff.toString() ?? '—',
        icon: Icons.people_alt_rounded,
        color: const Color(0xFFEA580C),
        bgColor: const Color(0xFFFFF7ED),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const StaffScreen(initialRole: null),
          ),
        ),
      ),
      _StatData(
        label: 'Admin Users',
        value: stats?.totalAdmins.toString() ?? '—',
        icon: Icons.security_rounded,
        color: const Color(0xFFEF4444),
        bgColor: const Color(0xFFFEF2F2),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminUsersScreen())),
      ),
      _StatData(
        label: 'Classes',
        value: stats?.totalClasses.toString() ?? '—',
        icon: Icons.category_rounded,
        color: const Color(0xFF14B8A6),
        bgColor: const Color(0xFFF0FDFA),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ClassesScreen())),
      ),
      _StatData(
        label: 'Branches',
        value: stats?.totalBranches.toString() ?? '—',
        icon: Icons.business_rounded,
        color: const Color(0xFF6366F1),
        bgColor: const Color(0xFFEEF2FF),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BranchesScreen())),
      ),
    ];

    if (screenWidth >= 1150) {
      // 5 on top, 3 on bottom matching screenshot
      return Column(
        children: [
          Row(
            children: [
              for (int i = 0; i < 5; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(child: _buildStatCard(cards[i])),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (int i = 5; i < 8; i++) ...[
                if (i > 5) const SizedBox(width: 12),
                Expanded(child: _buildStatCard(cards[i])),
              ],
              const SizedBox(width: 12),
              const Expanded(child: SizedBox()),
              const SizedBox(width: 12),
              const Expanded(child: SizedBox()),
            ],
          ),
        ],
      );
    } else if (screenWidth >= 700) {
      // 4 cards per row
      return Column(
        children: [
          Row(
            children: [
              for (int i = 0; i < 4; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(child: _buildStatCard(cards[i])),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (int i = 4; i < 8; i++) ...[
                if (i > 4) const SizedBox(width: 12),
                Expanded(child: _buildStatCard(cards[i])),
              ],
            ],
          ),
        ],
      );
    } else {
      // 2 cards per row on mobile
      return Column(
        children: [
          for (int r = 0; r < 4; r++) ...[
            if (r > 0) const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _buildStatCard(cards[r * 2])),
                const SizedBox(width: 10),
                Expanded(child: _buildStatCard(cards[r * 2 + 1])),
              ],
            ),
          ],
        ],
      );
    }
  }

  Widget _buildStatCard(_StatData data) {
    return InkWell(
      onTap: data.onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        height: 74,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            children: [
              // Decorative background bubble in top right
              Positioned(
                top: -18,
                right: -18,
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: data.color.withValues(alpha: 0.07),
                  ),
                ),
              ),

              // Left colored border accent strip
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: data.color,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(14),
                      bottomLeft: Radius.circular(14),
                    ),
                  ),
                ),
              ),

              // Content
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: data.bgColor,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(data.icon, color: data.color, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            data.value,
                            style: const TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1E293B),
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            data.label,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
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

  // =========================================================================
  // TODAY'S ATTENDANCE CARD
  // =========================================================================
  Widget _buildAttendanceCard(DashboardProvider dash) {
    final summary = dash.attendanceSummary;
    final total = summary?.total ?? 0;
    final present = summary?.present ?? 0;
    final absent = summary?.absent ?? 0;
    final late = summary?.late ?? 0;

    final dateFormatted = DateFormat('MM/dd/yyyy').format(dash.selectedDate);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Purple Gradient Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.event_note_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Today's Attendance",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        "Attendance overview for selected date",
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                // Date picker button
                InkWell(
                  onTap: () => _pickDate(context, dash),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF4F46E5)),
                        const SizedBox(width: 6),
                        Text(
                          dateFormatted,
                          style: const TextStyle(
                            color: Color(0xFF1E293B),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.calendar_month, size: 14, color: Color(0xFF64748B)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Filter & Search Controls Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Left Controls: Tabs + Dropdowns
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    // Tabs: [Students] [Staff]
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildTabButton('Students', dash.attType == 'student', () {
                            dash.setAttType('student');
                          }),
                          _buildTabButton('Staff', dash.attType == 'staff', () {
                            dash.setAttType('staff');
                          }),
                        ],
                      ),
                    ),

                    // Branch Dropdown
                    Builder(builder: (context) {
                      final branchItems = <DropdownMenuItem<String?>>[
                        const DropdownMenuItem<String?>(
                          value: null,
                          child: Text('All Branches'),
                        ),
                      ];
                      final seenBranch = <String?>{null};
                      for (final b in dash.branches) {
                        final bId = b['id']?.toString().trim();
                        if (bId != null && bId.isNotEmpty && seenBranch.add(bId)) {
                          branchItems.add(
                            DropdownMenuItem<String?>(
                              value: bId,
                              child: Text(b['name'] ?? 'Branch'),
                            ),
                          );
                        }
                      }
                      final safeBranch = branchItems.any((i) => i.value == dash.selectedBranchId) ? dash.selectedBranchId : null;

                      return Container(
                        height: 36,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String?>(
                            value: safeBranch,
                            hint: const Text('All Branches', style: TextStyle(fontSize: 12, color: Color(0xFF1E293B))),
                            style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                            items: branchItems,
                            onChanged: (val) => dash.setSelectedBranch(val),
                          ),
                        ),
                      );
                    }),

                    // Class Dropdown (if student mode and classes available)
                    if (dash.attType == 'student' && dash.classes.isNotEmpty)
                      Builder(builder: (context) {
                        final classItems = <DropdownMenuItem<String?>>[
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('All Classes'),
                          ),
                        ];
                        final seenClass = <String?>{null};
                        for (final c in dash.classes) {
                          final cId = c['id']?.toString().trim();
                          if (cId != null && cId.isNotEmpty && seenClass.add(cId)) {
                            final name = "${c['name'] ?? ''} ${c['section'] ?? ''}".trim();
                            classItems.add(
                              DropdownMenuItem<String?>(
                                value: cId,
                                child: Text(name.isNotEmpty ? name : 'Class'),
                              ),
                            );
                          }
                        }
                        final safeClass = classItems.any((i) => i.value == dash.selectedClassId) ? dash.selectedClassId : null;

                        return Container(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String?>(
                              value: safeClass,
                              hint: const Text('All Classes', style: TextStyle(fontSize: 12, color: Color(0xFF1E293B))),
                              style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                              items: classItems,
                              onChanged: (val) => dash.setSelectedClass(val),
                            ),
                          ),
                        );
                      }),
                  ],
                ),

                // Right: Search Input
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 180, maxWidth: 240),
                  child: Container(
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        hintText: 'Search attendance...',
                        hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                        prefixIcon: const Icon(Icons.search, size: 16, color: Color(0xFF94A3B8)),
                        prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 16),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? InkWell(
                                onTap: () {
                                  _searchController.clear();
                                  dash.setSearchTerm('');
                                },
                                child: const Icon(Icons.clear, size: 14, color: Color(0xFF94A3B8)),
                              )
                            : null,
                      ),
                      onChanged: (val) => dash.setSearchTerm(val),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. 4 Attendance Summary KPI Boxes
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Expanded(child: _buildAttendanceKpiBox('TOTAL', total.toString(), const Color(0xFF2563EB))),
                const SizedBox(width: 10),
                Expanded(child: _buildAttendanceKpiBox('PRESENT', present.toString(), const Color(0xFF10B981))),
                const SizedBox(width: 10),
                Expanded(child: _buildAttendanceKpiBox('ABSENT', absent.toString(), const Color(0xFFEF4444))),
                const SizedBox(width: 10),
                Expanded(child: _buildAttendanceKpiBox('LATE', late.toString(), const Color(0xFFF59E0B))),
              ],
            ),
          ),
          const SizedBox(height: 6),

          // 4. Attendance Table
          _buildAttendanceTable(dash),
        ],
      ),
    );
  }

  Widget _buildTabButton(String label, bool active, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.bold : FontWeight.w500,
            color: active ? const Color(0xFF4F46E5) : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildAttendanceKpiBox(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Left vertical color accent
          Positioned(
            left: -10,
            top: -10,
            bottom: -10,
            child: Container(
              width: 3.5,
              decoration: BoxDecoration(
                color: color,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(8),
                  bottomLeft: Radius.circular(8),
                ),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF64748B),
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // ATTENDANCE TABLE
  // =========================================================================
  Widget _buildAttendanceTable(DashboardProvider dash) {
    if (dash.isAttendanceLoading) {
      return const Padding(
        padding: EdgeInsets.all(40),
        child: Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5)),
          ),
        ),
      );
    }

    final records = dash.filteredRecords;

    if (records.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 36, horizontal: 16),
        child: Center(
          child: Text(
            'No attendance records found',
            style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth < 620 ? 620 : constraints.maxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Table Header Row
                Container(
                  color: const Color(0xFFF8FAFC),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      const Expanded(
                        flex: 3,
                        child: Text(
                          'NAME',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          dash.attType == 'student' ? 'CLASS' : 'ROLE',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                        ),
                      ),
                      const Expanded(
                        flex: 2,
                        child: Text(
                          'BRANCH',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                        ),
                      ),
                      const Expanded(
                        flex: 2,
                        child: Text(
                          'PUNCH TIME',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                        ),
                      ),
                      const Expanded(
                        flex: 1,
                        child: Text(
                          'STATUS',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),

                // Table Data Rows
                ...records.map((r) {
                  final record = r is Map ? r : <String, dynamic>{};
                  final fullName = (record['full_name'] ?? 'Unknown').toString();
                  final subId = dash.attType == 'student'
                      ? (record['admission_no'] ?? '').toString()
                      : (record['staff_id'] ?? '').toString();

                  final classOrRole = dash.attType == 'student'
                      ? '${record['class_name'] ?? ''} ${record['section'] ?? ''}'.trim()
                      : (record['role_type'] ?? record['designation'] ?? '—').toString();

                  final branchName = (record['branch_name'] ?? '—').toString();
                  final punchTime = (record['check_in'] ?? record['check_out'] ?? '—').toString();
                  final status = record['status']?.toString();

                  final avatarColor = _getAvatarColor(fullName);
                  final firstChar = fullName.isNotEmpty ? fullName[0].toUpperCase() : '?';

                  return Container(
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0xFFF1F5F9)),
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                    child: Row(
                      children: [
                        // NAME + Avatar + Sub ID
                        Expanded(
                          flex: 3,
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 14,
                                backgroundColor: avatarColor,
                                child: Text(
                                  firstChar,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      fullName,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF1E293B),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    if (subId.isNotEmpty)
                                      Text(
                                        subId,
                                        style: const TextStyle(
                                          fontSize: 10,
                                          color: Color(0xFF64748B),
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        // CLASS / ROLE
                        Expanded(
                          flex: 2,
                          child: Text(
                            classOrRole.isNotEmpty ? classOrRole : '—',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF334155)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),

                        // BRANCH
                        Expanded(
                          flex: 2,
                          child: Text(
                            branchName,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF334155)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),

                        // PUNCH TIME
                        Expanded(
                          flex: 2,
                          child: Text(
                            punchTime,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),

                        // STATUS
                        Expanded(
                          flex: 1,
                          child: _buildStatusBadge(status),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusBadge(String? status) {
    if (status == null || status.isEmpty) {
      return const Text('—', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13));
    }

    Color bg;
    Color fg;
    Color border;

    switch (status.toLowerCase()) {
      case 'present':
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF16A34A);
        border = const Color(0xFF86EFAC);
        break;
      case 'absent':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFDC2626);
        border = const Color(0xFFFCA5A5);
        break;
      case 'late':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFD97706);
        border = const Color(0xFFFDE68A);
        break;
      case 'half-day':
        bg = const Color(0xFFF3E8FF);
        fg = const Color(0xFF9333EA);
        border = const Color(0xFFD8B4FE);
        break;
      default:
        bg = const Color(0xFFF1F5F9);
        fg = const Color(0xFF64748B);
        border = const Color(0xFFCBD5E1);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border, width: 0.8),
      ),
      child: Text(
        status.toLowerCase(),
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  // =========================================================================
  // ATTENDANCE SUMMARY CARD (RIGHT COLUMN)
  // =========================================================================
  Widget _buildAttendanceSummaryCard(DashboardProvider dash) {
    final summary = dash.attendanceSummary;
    final present = summary?.present ?? 0;
    final absent = summary?.absent ?? 0;
    final late = summary?.late ?? 0;
    final total = present + absent + late;

    final hasData = total > 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Attendance Summary',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Daily attendance breakdown',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.trending_up_rounded, color: Color(0xFF16A34A), size: 18),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Body: Donut Chart or No Data
          if (!hasData)
            const SizedBox(
              height: 140,
              child: Center(
                child: Text(
                  'No attendance data available.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            )
          else ...[
            SizedBox(
              height: 160,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 3,
                  centerSpaceRadius: 42,
                  sections: [
                    if (present > 0)
                      PieChartSectionData(
                        color: const Color(0xFF10B981),
                        value: present.toDouble(),
                        showTitle: false,
                        radius: 20,
                      ),
                    if (absent > 0)
                      PieChartSectionData(
                        color: const Color(0xFFEF4444),
                        value: absent.toDouble(),
                        showTitle: false,
                        radius: 20,
                      ),
                    if (late > 0)
                      PieChartSectionData(
                        color: const Color(0xFFF59E0B),
                        value: late.toDouble(),
                        showTitle: false,
                        radius: 20,
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildLegendItem('Present', present, const Color(0xFF10B981)),
                _buildLegendItem('Absent', absent, const Color(0xFFEF4444)),
                _buildLegendItem('Late', late, const Color(0xFFF59E0B)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, int count, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '$label: ',
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        Text(
          '$count',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
        ),
      ],
    );
  }

  // =========================================================================
  // RECENT NOTICES CARD (RIGHT COLUMN)
  // =========================================================================
  Widget _buildRecentNoticesCard(DashboardProvider dash) {
    final notices = dash.recentNotices;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Recent Notices',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Latest announcements',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3E8FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF9333EA), size: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Body: List or Empty
          if (notices.isEmpty)
            const SizedBox(
              height: 100,
              child: Center(
                child: Text(
                  'No notices available.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            )
          else
            Column(
              children: notices.take(3).map((notice) {
                return InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const NoticesScreen()),
                    );
                  },
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: notice.isImportant ? const Color(0xFFFEE2E2) : const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Icon(
                            Icons.campaign_rounded,
                            size: 16,
                            color: notice.isImportant ? const Color(0xFFDC2626) : const Color(0xFF2563EB),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      notice.title,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF1E293B),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (notice.isImportant)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEE2E2),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'Urgent',
                                        style: TextStyle(
                                          color: Color(0xFFDC2626),
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                notice.content,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}

class _StatData {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final VoidCallback? onTap;

  _StatData({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.bgColor,
    this.onTap,
  });
}
