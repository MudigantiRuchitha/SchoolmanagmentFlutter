import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../notices/notices_screen.dart';
import '../settings/settings_screen.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final ApiService _api = ApiService(StorageService());
  List<dynamic> _admins = [];
  List<dynamic> _branches = [];
  bool _isLoading = true;
  String _search = '';
  String _filterRole = ''; // '' = all, 'admin', 'manager', 'viewer'
  String _filterBranch = ''; // '' = all, 'all' = All Branches, or branchId
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        _api.getAdmins(),
        _api.getBranches(),
      ]);
      if (mounted) {
        setState(() {
          _admins = results[0];
          _branches = results[1];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  List<dynamic> get _filteredAdmins {
    return _admins.where((a) {
      final q = _search.toLowerCase().trim();
      final username = (a['username'] ?? '').toString().toLowerCase();
      final fullName = (a['full_name'] ?? a['fullName'] ?? '').toString().toLowerCase();
      final email = (a['email'] ?? '').toString().toLowerCase();
      final phone = (a['phone'] ?? '').toString();

      final matchesSearch = q.isEmpty ||
          username.contains(q) ||
          fullName.contains(q) ||
          email.contains(q) ||
          phone.contains(q);

      final role = (a['role'] ?? 'admin').toString().toLowerCase();
      final matchesRole = _filterRole.isEmpty || role == _filterRole;

      final branchAccess = (a['branch_access'] ?? a['branchAccess'] ?? 'all').toString();
      final matchesBranch = _filterBranch.isEmpty || branchAccess == _filterBranch;

      return matchesSearch && matchesRole && matchesBranch;
    }).toList();
  }

  // =========================================================================
  // VIEW ADMIN DETAILS MODAL
  // =========================================================================
  Future<void> _openAdminDetails(dynamic admin) async {
    showDialog(
      context: context,
      builder: (ctx) => _AdminDetailsDialog(
        admin: admin,
        branches: _branches,
        api: _api,
        onRefreshNeeded: _loadData,
        onEditRequested: (adminData) {
          Navigator.pop(ctx);
          _showAdminDialog(adminData);
        },
      ),
    );
  }

  // =========================================================================
  // ADD / EDIT ADMIN USER MODAL
  // =========================================================================
  void _showAdminDialog([Map<String, dynamic>? admin]) {
    final isEdit = admin != null;

    final usernameCtrl = TextEditingController(text: admin?['username'] ?? '');
    final passwordCtrl = TextEditingController();
    final nameCtrl = TextEditingController(text: admin?['full_name'] ?? admin?['fullName'] ?? '');
    final emailCtrl = TextEditingController(text: admin?['email'] ?? '');
    final phoneCtrl = TextEditingController(text: admin?['phone'] ?? '');

    String selectedRole = (admin?['role'] ?? 'admin').toString().toLowerCase();
    String selectedBranch = (admin?['branch_access'] ?? admin?['branchAccess'] ?? 'all').toString();
    bool isActive = admin != null ? (admin['is_active'] == true || admin['is_active'] == 1) : true;

    String? dialogError;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            backgroundColor: Colors.white,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 540),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF2FF),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              isEdit ? Icons.edit_rounded : Icons.person_add_alt_1_rounded,
                              color: const Color(0xFF4F46E5),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              isEdit ? 'Edit Admin User: ${admin['username']}' : 'Add New Admin User',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      if (dialogError != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 14),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFFCA5A5)),
                          ),
                          child: Text(dialogError!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
                        ),

                      // Form Fields
                      Row(
                        children: [
                          Expanded(
                            child: _buildInput('Username *', usernameCtrl, 'e.g. jdoe', enabled: !isEdit),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildInput(
                              isEdit ? 'New Password (Optional)' : 'Password *',
                              passwordCtrl,
                              '••••••••',
                              isPassword: true,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      _buildInput('Full Name *', nameCtrl, 'e.g. John Doe'),
                      const SizedBox(height: 12),

                      Row(
                        children: [
                          Expanded(child: _buildInput('Email *', emailCtrl, 'admin@school.edu.in', isEmail: true)),
                          const SizedBox(width: 12),
                          Expanded(child: _buildInput('Phone *', phoneCtrl, '9876543210', isPhone: true)),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Role and Branch Access Row
                      Row(
                        children: [
                          // Role Dropdown
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Access Level *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: DropdownButtonHideUnderline(
                                    child: Builder(builder: (context) {
                                      const roleItems = [
                                        DropdownMenuItem(value: 'admin', child: Text('Full Access (Admin)', style: TextStyle(fontSize: 13))),
                                        DropdownMenuItem(value: 'manager', child: Text('Read & Write (Manager)', style: TextStyle(fontSize: 13))),
                                        DropdownMenuItem(value: 'viewer', child: Text('Only Read (Viewer)', style: TextStyle(fontSize: 13))),
                                      ];
                                      final safeRole = roleItems.any((i) => i.value == selectedRole) ? selectedRole : 'admin';

                                      return DropdownButton<String>(
                                        value: safeRole,
                                        isExpanded: true,
                                        items: roleItems,
                                        onChanged: (v) {
                                          if (v != null) setDialogState(() => selectedRole = v);
                                        },
                                      );
                                    }),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),

                          // Branch Access Dropdown
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Branch Access *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: DropdownButtonHideUnderline(
                                    child: Builder(builder: (context) {
                                      final branchItems = <DropdownMenuItem<String>>[
                                        const DropdownMenuItem(value: 'all', child: Text('All Branches', style: TextStyle(fontSize: 13))),
                                      ];
                                      final seenBranchIds = <String>{'all'};
                                      for (final b in _branches) {
                                        final bId = b['id']?.toString().trim() ?? '';
                                        if (bId.isNotEmpty && seenBranchIds.add(bId)) {
                                          branchItems.add(
                                            DropdownMenuItem(
                                              value: bId,
                                              child: Text(b['name'] ?? 'Branch', style: const TextStyle(fontSize: 13)),
                                            ),
                                          );
                                        }
                                      }
                                      final safeBranch = branchItems.any((i) => i.value == selectedBranch) ? selectedBranch : 'all';

                                      return DropdownButton<String>(
                                        value: safeBranch,
                                        isExpanded: true,
                                        items: branchItems,
                                        onChanged: (v) {
                                          if (v != null) setDialogState(() => selectedBranch = v);
                                        },
                                      );
                                    }),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Status Toggle
                      Row(
                        children: [
                          Switch(
                            value: isActive,
                            activeColor: const Color(0xFF10B981),
                            onChanged: (v) => setDialogState(() => isActive = v),
                          ),
                          const SizedBox(width: 8),
                          Text(isActive ? 'Account Active' : 'Account Inactive', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Buttons
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx),
                            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                          ),
                          const SizedBox(width: 10),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF4F46E5),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: isSaving
                                ? null
                                : () async {
                                    if (usernameCtrl.text.trim().isEmpty || nameCtrl.text.trim().isEmpty) {
                                      setDialogState(() => dialogError = 'Please fill all required fields.');
                                      return;
                                    }
                                    if (!isEdit && passwordCtrl.text.trim().isEmpty) {
                                      setDialogState(() => dialogError = 'Password is required for new accounts.');
                                      return;
                                    }

                                    setDialogState(() {
                                      isSaving = true;
                                      dialogError = null;
                                    });

                                    try {
                                      if (isEdit) {
                                        final updateData = <String, dynamic>{
                                          'fullName': nameCtrl.text.trim(),
                                          'email': emailCtrl.text.trim(),
                                          'phone': phoneCtrl.text.trim(),
                                          'role': selectedRole,
                                          'branchAccess': selectedBranch,
                                          'isActive': isActive,
                                        };
                                        if (passwordCtrl.text.trim().isNotEmpty) {
                                          updateData['password'] = passwordCtrl.text.trim();
                                        }
                                        await _api.updateAdmin(admin['id'], updateData);
                                      } else {
                                        await _api.createAdmin({
                                          'username': usernameCtrl.text.trim(),
                                          'password': passwordCtrl.text.trim(),
                                          'fullName': nameCtrl.text.trim(),
                                          'email': emailCtrl.text.trim(),
                                          'phone': phoneCtrl.text.trim(),
                                          'role': selectedRole,
                                          'branchAccess': selectedBranch,
                                          'isActive': isActive,
                                        });
                                      }

                                      if (mounted) {
                                        Navigator.pop(ctx);
                                        _loadData();
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text(isEdit ? 'Admin updated successfully!' : 'Admin user created successfully!'),
                                            backgroundColor: const Color(0xFF10B981),
                                          ),
                                        );
                                      }
                                    } catch (e) {
                                      setDialogState(() {
                                        isSaving = false;
                                        dialogError = e.toString();
                                      });
                                    }
                                  },
                            child: Text(isSaving ? 'Saving...' : (isEdit ? 'Update Admin' : 'Add Admin User')),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInput(String label, TextEditingController ctrl, String hint, {bool isPhone = false, bool isEmail = false, bool isPassword = false, bool enabled = true}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          enabled: enabled,
          obscureText: isPassword,
          keyboardType: isPhone ? TextInputType.phone : (isEmail ? TextInputType.emailAddress : TextInputType.text),
          style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            filled: !enabled,
            fillColor: !enabled ? const Color(0xFFF1F5F9) : Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF4F46E5), width: 1.5)),
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // MAIN BUILD METHOD
  // =========================================================================
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    // Stats calculations
    final total = _admins.length;
    final active = _admins.where((a) => a['is_active'] == true || a['is_active'] == 1).length;
    final fullAdmins = _admins.where((a) => (a['role'] ?? '').toString().toLowerCase() == 'admin').length;
    final managers = _admins.where((a) => (a['role'] ?? '').toString().toLowerCase() == 'manager').length;
    final viewers = _admins.where((a) => (a['role'] ?? '').toString().toLowerCase() == 'viewer').length;

    final filtered = _filteredAdmins;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const CustomAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. PAGE TITLE & SUBTITLE
                const PageHeaderTitle(
                  title: 'Admin Users',
                  subtitle: 'Manage organisation administrators, assign granular access levels, and set branch permissions',
                ),

                // 2. 5 STATS CARDS ROW
                _buildStatsRow(
                  total: total,
                  active: active,
                  fullAdmins: fullAdmins,
                  managers: managers,
                  viewers: viewers,
                  screenWidth: constraints.maxWidth,
                ),
                const SizedBox(height: 20),

                // 3. TOOLBAR (Search, Access Dropdown, Branch Dropdown, Showing X, Add Admin)
                _buildToolbar(filtered.length),
                const SizedBox(height: 14),

                // 4. DATA TABLE
                _buildTable(filtered),
                const SizedBox(height: 40),
              ],
            );
          },
        ),
      ),
    );
  }

  // =========================================================================
  // 5 STATS CARDS ROW
  // =========================================================================
  Widget _buildStatsRow({
    required int total,
    required int active,
    required int fullAdmins,
    required int managers,
    required int viewers,
    required double screenWidth,
  }) {
    final cards = [
      _buildStatCard('Total Admin Users', total.toString(), Icons.lock_outline_rounded, const Color(0xFF0F172A)),
      _buildStatCard('Active Users', active.toString(), Icons.check_circle_rounded, const Color(0xFF10B981)),
      _buildStatCard('Full Access\n(Admins)', fullAdmins.toString(), Icons.security_rounded, const Color(0xFF6366F1)),
      _buildStatCard('Read & Write\n(Managers)', managers.toString(), Icons.edit_rounded, const Color(0xFF3B82F6)),
      _buildStatCard('Only Read\n(Viewers)', viewers.toString(), Icons.visibility_rounded, const Color(0xFF0F172A)),
    ];

    if (screenWidth >= 980) {
      return Row(
        children: [
          for (int i = 0; i < 5; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(child: cards[i]),
          ],
        ],
      );
    } else if (screenWidth >= 650) {
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: cards.map((c) => SizedBox(width: (screenWidth - 64) / 3, child: c)).toList(),
      );
    } else {
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: cards.map((c) => SizedBox(width: (screenWidth - 50) / 2, child: c)).toList(),
      );
    }
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFF0F172A), size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: valueColor,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                    height: 1.15,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // TOOLBAR (SEARCH, ACCESS LEVEL, BRANCH FILTER, COUNT, ADD)
  // =========================================================================
  Widget _buildToolbar(int count) {
    return Wrap(
      spacing: 12,
      runSpacing: 10,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Left Filters
        Wrap(
          spacing: 10,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            // Search Input
            Container(
              width: 240,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: TextField(
                style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                decoration: const InputDecoration(
                  isDense: true,
                  hintText: 'Search by username, name, er...',
                  hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  prefixIcon: Icon(Icons.search_rounded, size: 16, color: Color(0xFF94A3B8)),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                ),
                onChanged: (v) => setState(() => _search = v),
              ),
            ),

            // Access Level Dropdown
            Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: DropdownButtonHideUnderline(
                child: Builder(builder: (context) {
                  const roleFilters = [
                    DropdownMenuItem(value: '', child: Text('All Access Levels')),
                    DropdownMenuItem(value: 'admin', child: Text('Full Access (Admin)')),
                    DropdownMenuItem(value: 'manager', child: Text('Read & Write (Manager)')),
                    DropdownMenuItem(value: 'viewer', child: Text('Only Read Access (Viewer)')),
                  ];
                  final safeRole = roleFilters.any((i) => i.value == _filterRole) ? _filterRole : '';

                  return DropdownButton<String>(
                    value: safeRole,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                    items: roleFilters,
                    onChanged: (val) => setState(() => _filterRole = val ?? ''),
                  );
                }),
              ),
            ),

            // Branch Access Dropdown
            Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: DropdownButtonHideUnderline(
                child: Builder(builder: (context) {
                  final branchFilters = <DropdownMenuItem<String>>[
                    const DropdownMenuItem(value: '', child: Text('All Branches Access')),
                    const DropdownMenuItem(value: 'all', child: Text('All Branches (Global)')),
                  ];
                  final seenBranchIds = <String>{'', 'all'};
                  for (final b in _branches) {
                    final bId = b['id']?.toString().trim() ?? '';
                    if (bId.isNotEmpty && seenBranchIds.add(bId)) {
                      branchFilters.add(
                        DropdownMenuItem(
                          value: bId,
                          child: Text(b['name'] ?? 'Branch'),
                        ),
                      );
                    }
                  }
                  final safeBranch = branchFilters.any((i) => i.value == _filterBranch) ? _filterBranch : '';

                  return DropdownButton<String>(
                    value: safeBranch,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                    items: branchFilters,
                    onChanged: (val) => setState(() => _filterBranch = val ?? ''),
                  );
                }),
              ),
            ),

            // Count
            Text(
              'Showing $count users',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),

        // Right: + Add Admin User
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF4F46E5),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          ),
          onPressed: () => _showAdminDialog(),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Admin User', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  // =========================================================================
  // DATA TABLE
  // =========================================================================
  Widget _buildTable(List<dynamic> list) {
    if (_isLoading) {
      return Container(
        height: 250,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5)),
        ),
      );
    }

    if (_errorMessage != null) {
      return Container(
        height: 180,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Center(
          child: Text('Error: $_errorMessage', style: const TextStyle(color: Color(0xFFDC2626))),
        ),
      );
    }

    if (list.isEmpty) {
      return Container(
        height: 200,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.person_off_rounded, size: 36, color: Color(0xFF94A3B8)),
              SizedBox(height: 8),
              Text('No admin users found', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              SizedBox(height: 4),
              Text('Create an admin user account to manage campus permissions', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            ],
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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
        borderRadius: BorderRadius.circular(12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 980),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Row
                Container(
                  color: const Color(0xFFF8FAFC),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: const Row(
                    children: [
                      SizedBox(width: 140, child: Text('USERNAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 180, child: Text('FULL NAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 220, child: Text('CONTACT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 200, child: Text('ACCESS LEVEL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 160, child: Text('ASSIGNED BRANCH ACCESS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 100, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 60, child: Text('ACTIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),

                // Data Rows
                for (final a in list) ...[
                  _buildAdminRow(a),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAdminRow(dynamic a) {
    final username = (a['username'] ?? '—').toString();
    final fullName = (a['full_name'] ?? a['fullName'] ?? '—').toString();
    final email = (a['email'] ?? '').toString();
    final phone = (a['phone'] ?? '').toString();
    final role = (a['role'] ?? 'admin').toString().toLowerCase();
    final branchAccess = (a['branch_access'] ?? a['branchAccess'] ?? 'all').toString();
    final isActive = a['is_active'] == true || a['is_active'] == 1;

    // Resolve branch name
    String branchLabel = 'All Branches';
    if (branchAccess != 'all') {
      final found = _branches.firstWhere(
        (b) => b['id']?.toString() == branchAccess,
        orElse: () => null,
      );
      if (found != null) {
        branchLabel = found['name'] ?? 'Branch #$branchAccess';
      } else {
        branchLabel = 'Branch #$branchAccess';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. USERNAME
          SizedBox(
            width: 140,
            child: Text(
              username,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A), fontFamily: 'monospace'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),

          // 2. FULL NAME
          SizedBox(
            width: 180,
            child: Text(
              fullName,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),

          // 3. CONTACT (Email + Phone)
          SizedBox(
            width: 220,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (email.isNotEmpty)
                  Text(email, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis),
                if (phone.isNotEmpty)
                  Text(phone, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),

          // 4. ACCESS LEVEL BADGE
          SizedBox(
            width: 200,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _buildRoleBadge(role),
            ),
          ),

          // 5. ASSIGNED BRANCH ACCESS
          SizedBox(
            width: 160,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3E8FF),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.business_rounded, size: 12, color: Color(0xFF7C3AED)),
                    const SizedBox(width: 4),
                    Text(
                      branchLabel,
                      style: const TextStyle(color: Color(0xFF7C3AED), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 6. STATUS
          SizedBox(
            width: 100,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: isActive ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5), width: 0.8),
                ),
                child: Text(
                  isActive ? '● Active' : '● Inactive',
                  style: TextStyle(
                    color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),

          // 7. ACTIONS (Eye Button)
          SizedBox(
            width: 60,
            child: Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                onTap: () => _openAdminDetails(a),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Icon(Icons.visibility_outlined, size: 15, color: Color(0xFF475569)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    if (role == 'admin') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFEEF2FF),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield_rounded, size: 12, color: Color(0xFF4F46E5)),
            SizedBox(width: 4),
            Text('Full Access (Admin)', style: TextStyle(color: Color(0xFF4F46E5), fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    } else if (role == 'manager') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.edit_rounded, size: 12, color: Color(0xFF2563EB)),
            SizedBox(width: 4),
            Text('Read & Write (Manager)', style: TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.visibility_rounded, size: 12, color: Color(0xFF334155)),
            SizedBox(width: 4),
            Text('Only Read Access (Viewer)', style: TextStyle(color: Color(0xFF334155), fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }
  }
}

// =========================================================================
// VIEW ADMIN USER DETAILS DIALOG
// =========================================================================
class _AdminDetailsDialog extends StatefulWidget {
  final dynamic admin;
  final List<dynamic> branches;
  final ApiService api;
  final VoidCallback onRefreshNeeded;
  final Function(Map<String, dynamic>) onEditRequested;

  const _AdminDetailsDialog({
    required this.admin,
    required this.branches,
    required this.api,
    required this.onRefreshNeeded,
    required this.onEditRequested,
  });

  @override
  State<_AdminDetailsDialog> createState() => _AdminDetailsDialogState();
}

class _AdminDetailsDialogState extends State<_AdminDetailsDialog> {
  Future<void> _toggleStatus() async {
    final a = widget.admin;
    final currentActive = a['is_active'] == true || a['is_active'] == 1;
    final nextActive = !currentActive;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Status Change'),
        content: Text('Are you sure you want to ${nextActive ? "activate" : "deactivate"} account "${a['username']}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: nextActive ? const Color(0xFF10B981) : const Color(0xFFD97706)),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(nextActive ? 'Activate' : 'Deactivate'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await widget.api.updateAdmin(a['id'], {'isActive': nextActive});
        if (!mounted) return;
        Navigator.pop(context);
        widget.onRefreshNeeded();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('User ${nextActive ? "activated" : "deactivated"} successfully.')),
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  Future<void> _deleteUser() async {
    final a = widget.admin;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Admin Account?'),
        content: Text('Are you sure you want to delete administrator "${a['username']}"? This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await widget.api.deleteAdmin(a['id']);
        if (!mounted) return;
        Navigator.pop(context);
        widget.onRefreshNeeded();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Admin user deleted successfully.')),
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.admin;
    final username = a['username'] ?? '—';
    final fullName = a['full_name'] ?? a['fullName'] ?? '—';
    final email = a['email'] ?? '—';
    final phone = a['phone'] ?? '—';
    final role = (a['role'] ?? 'admin').toString().toLowerCase();
    final branchAccess = (a['branch_access'] ?? a['branchAccess'] ?? 'all').toString();
    final isActive = a['is_active'] == true || a['is_active'] == 1;

    String branchLabel = 'All Branches (Full Access)';
    if (branchAccess != 'all') {
      final found = widget.branches.firstWhere(
        (b) => b['id']?.toString() == branchAccess,
        orElse: () => null,
      );
      if (found != null) {
        branchLabel = found['name'] ?? 'Branch #$branchAccess';
      } else {
        branchLabel = 'Branch #$branchAccess';
      }
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: Colors.white,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 540),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.admin_panel_settings_rounded, color: Color(0xFF4F46E5), size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Admin User: $username',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Details Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(child: _buildDetailField('Username', username, isMono: true)),
                          Expanded(child: _buildDetailField('Full Name', fullName)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _buildDetailField('Email', email)),
                          Expanded(child: _buildDetailField('Phone', phone)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _buildDetailField('Access Level', role.toUpperCase(), isRole: true, role: role)),
                          Expanded(child: _buildDetailField('Status', isActive ? 'Active' : 'Inactive', isStatus: true, isActive: isActive)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _buildDetailField('Branch Permission', branchLabel)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Action Buttons (Edit, Toggle Status, Delete)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => widget.onEditRequested(Map<String, dynamic>.from(a)),
                      icon: const Icon(Icons.edit_outlined, size: 15, color: Color(0xFF1E293B)),
                      label: const Text('Edit User', style: TextStyle(fontSize: 12, color: Color(0xFF1E293B))),
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isActive ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                        foregroundColor: isActive ? const Color(0xFFD97706) : const Color(0xFF15803D),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _toggleStatus,
                      icon: Icon(isActive ? Icons.cancel_outlined : Icons.check_circle_outline, size: 15),
                      label: Text(isActive ? 'Deactivate Account' : 'Activate Account', style: const TextStyle(fontSize: 12)),
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFEE2E2),
                        foregroundColor: const Color(0xFFDC2626),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _deleteUser,
                      icon: const Icon(Icons.delete_outline_rounded, size: 15),
                      label: const Text('Delete Account', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Close', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailField(String label, String value, {bool isMono = false, bool isStatus = false, bool isActive = true, bool isRole = false, String? role}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        if (isStatus)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626))),
          )
        else
          Text(
            value,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              fontFamily: isMono ? 'monospace' : null,
              color: const Color(0xFF0F172A),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }
}
