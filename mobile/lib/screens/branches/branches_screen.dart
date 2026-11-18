import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../notices/notices_screen.dart';
import '../settings/settings_screen.dart';

class BranchesScreen extends StatefulWidget {
  const BranchesScreen({super.key});

  @override
  State<BranchesScreen> createState() => _BranchesScreenState();
}

class _BranchesScreenState extends State<BranchesScreen> {
  final ApiService _api = ApiService(StorageService());
  List<dynamic> _branches = [];
  bool _isLoading = true;
  String _search = '';
  String _statusFilter = ''; // '' = all, 'active', 'inactive'
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final params = <String, dynamic>{};
      if (_statusFilter.isNotEmpty) params['status'] = _statusFilter;
      if (_search.trim().isNotEmpty) params['search'] = _search.trim();

      final list = await _api.getBranches(params);
      if (mounted) {
        setState(() {
          _branches = list;
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

  List<dynamic> get _filteredBranches {
    return _branches.where((b) {
      final q = _search.toLowerCase().trim();
      final name = (b['name'] ?? '').toString().toLowerCase();
      final code = (b['code'] ?? '').toString().toLowerCase();
      final contact = (b['contact_person'] ?? '').toString().toLowerCase();
      final phone = (b['phone'] ?? '').toString();

      final matchesSearch = q.isEmpty ||
          name.contains(q) ||
          code.contains(q) ||
          contact.contains(q) ||
          phone.contains(q);

      final isActive = b['is_active'] == true || b['is_active'] == 1;
      final matchesStatus = _statusFilter.isEmpty ||
          (_statusFilter == 'active' && isActive) ||
          (_statusFilter == 'inactive' && !isActive);

      return matchesSearch && matchesStatus;
    }).toList();
  }

  // =========================================================================
  // VIEW BRANCH DETAILS MODAL
  // =========================================================================
  Future<void> _openBranchDetails(dynamic b) async {
    showDialog(
      context: context,
      builder: (ctx) => _BranchDetailsDialog(
        branchSummary: b,
        api: _api,
        onRefreshNeeded: _loadBranches,
        onEditRequested: (branchData) {
          Navigator.pop(ctx);
          _showBranchDialog(branchData);
        },
      ),
    );
  }

  // =========================================================================
  // ADD / EDIT BRANCH DIALOG
  // =========================================================================
  void _showBranchDialog([Map<String, dynamic>? branch]) {
    final isEdit = branch != null;

    final nameCtrl = TextEditingController(text: branch?['name'] ?? '');
    final codeCtrl = TextEditingController(text: branch?['code'] ?? '');
    final contactCtrl = TextEditingController(text: branch?['contact_person'] ?? '');
    final phoneCtrl = TextEditingController(text: branch?['phone'] ?? '');
    final emailCtrl = TextEditingController(text: branch?['email'] ?? '');
    final addressCtrl = TextEditingController(text: branch?['address'] ?? '');
    final latCtrl = TextEditingController(text: branch?['latitude']?.toString() ?? '');
    final lngCtrl = TextEditingController(text: branch?['longitude']?.toString() ?? '');
    final radiusCtrl = TextEditingController(text: branch?['geofence_radius']?.toString() ?? '100');

    bool isActive = branch != null ? (branch['is_active'] == true || branch['is_active'] == 1) : true;
    bool createAdmin = false;
    final adminUserCtrl = TextEditingController();
    final adminPassCtrl = TextEditingController();
    final adminNameCtrl = TextEditingController();
    final adminEmailCtrl = TextEditingController();

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
              constraints: const BoxConstraints(maxWidth: 580),
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
                              isEdit ? Icons.edit_rounded : Icons.add_business_rounded,
                              color: const Color(0xFF4F46E5),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              isEdit ? 'Edit Branch: ${branch['name']}' : 'Add New Branch',
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
                            child: _buildInput('Branch Name *', nameCtrl, 'e.g. Manikonda Campus'),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildInput('Branch Code *', codeCtrl, 'e.g. MANI'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      Row(
                        children: [
                          Expanded(
                            child: _buildInput('Contact Person *', contactCtrl, 'Contact person name'),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildInput('Phone Number *', phoneCtrl, '9876543210', isPhone: true),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      _buildInput('Email Address *', emailCtrl, 'branch@school.edu.in', isEmail: true),
                      const SizedBox(height: 12),

                      _buildInput('Address', addressCtrl, 'Full branch address...', maxLines: 2),
                      const SizedBox(height: 16),

                      // GPS Geofence Box
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.gps_fixed_rounded, size: 16, color: Color(0xFF4F46E5)),
                                SizedBox(width: 6),
                                Text(
                                  'GPS Geofence Configuration',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(child: _buildInput('Latitude', latCtrl, '17.4097')),
                                const SizedBox(width: 8),
                                Expanded(child: _buildInput('Longitude', lngCtrl, '78.3728')),
                                const SizedBox(width: 8),
                                Expanded(child: _buildInput('Radius (m)', radiusCtrl, '100')),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Active status (edit mode)
                      if (isEdit)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Active Branch Status', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          value: isActive,
                          activeColor: const Color(0xFF4F46E5),
                          onChanged: (v) => setDialogState(() => isActive = v ?? true),
                        ),

                      // Dedicated Branch Admin (add mode)
                      if (!isEdit) ...[
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Create a Dedicated Branch Admin User', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5))),
                          subtitle: const Text('Automatically sets up an admin account scoped to this branch', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          value: createAdmin,
                          activeColor: const Color(0xFF4F46E5),
                          onChanged: (v) => setDialogState(() => createAdmin = v ?? false),
                        ),
                        if (createAdmin) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(child: _buildInput('Admin Username *', adminUserCtrl, 'admin_mani')),
                              const SizedBox(width: 10),
                              Expanded(child: _buildInput('Admin Password *', adminPassCtrl, 'Secure password', isPassword: true)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(child: _buildInput('Admin Full Name *', adminNameCtrl, 'Admin Full Name')),
                              const SizedBox(width: 10),
                              Expanded(child: _buildInput('Admin Email *', adminEmailCtrl, 'admin@mani.com', isEmail: true)),
                            ],
                          ),
                        ],
                      ],

                      const SizedBox(height: 20),

                      // Action Buttons
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
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            ),
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final name = nameCtrl.text.trim();
                                    final code = codeCtrl.text.trim().toUpperCase();
                                    final contact = contactCtrl.text.trim();
                                    final phone = phoneCtrl.text.trim();
                                    final email = emailCtrl.text.trim();

                                    if (name.isEmpty || code.isEmpty || contact.isEmpty || phone.isEmpty || email.isEmpty) {
                                      setDialogState(() => dialogError = 'Name, code, contact person, phone and email are required.');
                                      return;
                                    }
                                    if (createAdmin && (!adminUserCtrl.text.trim().isNotEmpty || !adminPassCtrl.text.trim().isNotEmpty)) {
                                      setDialogState(() => dialogError = 'Admin username and password are required.');
                                      return;
                                    }

                                    setDialogState(() {
                                      isSaving = true;
                                      dialogError = null;
                                    });

                                    final payload = <String, dynamic>{
                                      'name': name,
                                      'code': code,
                                      'contactPerson': contact,
                                      'phone': phone,
                                      'email': email,
                                      'address': addressCtrl.text.trim(),
                                      'latitude': latCtrl.text.trim().isNotEmpty ? double.tryParse(latCtrl.text.trim()) : null,
                                      'longitude': lngCtrl.text.trim().isNotEmpty ? double.tryParse(lngCtrl.text.trim()) : null,
                                      'geofenceRadius': int.tryParse(radiusCtrl.text.trim()) ?? 100,
                                      'isActive': isActive,
                                      if (!isEdit && createAdmin) ...{
                                        'createBranchAdmin': true,
                                        'adminUsername': adminUserCtrl.text.trim(),
                                        'adminPassword': adminPassCtrl.text.trim(),
                                        'adminFullName': adminNameCtrl.text.trim(),
                                        'adminEmail': adminEmailCtrl.text.trim(),
                                      },
                                    };

                                    try {
                                      if (isEdit) {
                                        await _api.updateBranch(branch['id'], payload);
                                      } else {
                                        await _api.createBranch(payload);
                                      }
                                      Navigator.pop(ctx);
                                      _loadBranches();
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text(isEdit ? 'Branch updated successfully!' : 'Branch created successfully!'),
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
                            child: isSaving
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : Text(isEdit ? 'Save Changes' : 'Create Branch'),
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

  Widget _buildInput(String label, TextEditingController ctrl, String hint, {bool isPhone = false, bool isEmail = false, bool isPassword = false, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
        const SizedBox(height: 5),
        TextField(
          controller: ctrl,
          keyboardType: isPhone ? TextInputType.phone : isEmail ? TextInputType.emailAddress : TextInputType.text,
          obscureText: isPassword,
          maxLines: maxLines,
          style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF4F46E5), width: 1.5)),
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // EXPORT CSV FEATURE
  // =========================================================================
  void _exportCSV() {
    final list = _filteredBranches;
    if (list.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No branches available to export.')),
      );
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln('ID,Branch Name,Code,Contact Person,Phone,Email,Address,Latitude,Longitude,Geofence Radius (m),Classes,Students,Staff,Status');
    for (final b in list) {
      final id = b['id'] ?? '';
      final name = '"${(b['name'] ?? '').toString().replaceAll('"', '""')}"';
      final code = b['code'] ?? '';
      final contact = '"${(b['contact_person'] ?? '').toString().replaceAll('"', '""')}"';
      final phone = b['phone'] ?? '';
      final email = b['email'] ?? '';
      final address = '"${(b['address'] ?? '').toString().replaceAll('"', '""')}"';
      final lat = b['latitude'] ?? '';
      final lng = b['longitude'] ?? '';
      final radius = b['geofence_radius'] ?? 100;
      final classes = b['class_count'] ?? 0;
      final students = b['student_count'] ?? 0;
      final staff = b['staff_count'] ?? 0;
      final status = (b['is_active'] == true || b['is_active'] == 1) ? 'Active' : 'Inactive';

      buffer.writeln('$id,$name,$code,$contact,$phone,$email,$address,$lat,$lng,$radius,$classes,$students,$staff,$status');
    }

    final csvString = buffer.toString();
    Clipboard.setData(ClipboardData(text: csvString));

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Text('Branch CSV exported and copied to clipboard (${list.length} rows)!'),
          ],
        ),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final filtered = _filteredBranches;

    // Stats calculations
    final total = _branches.length;
    final active = _branches.where((b) => b['is_active'] == true || b['is_active'] == 1).length;
    final inactive = total - active;
    final totalStudents = _branches.fold<int>(0, (sum, b) => sum + (int.tryParse(b['student_count']?.toString() ?? '0') ?? 0));
    final totalStaff = _branches.fold<int>(0, (sum, b) => sum + (int.tryParse(b['staff_count']?.toString() ?? '0') ?? 0));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const CustomAppBar(),
      body: RefreshIndicator(
        onRefresh: _loadBranches,
        color: const Color(0xFF4F46E5),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 900;

            return ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              children: [
                // 1. PAGE TITLE & SUBTITLE
                const PageHeaderTitle(
                  title: 'Branches',
                  subtitle: 'Manage campus locations, geofencing GPS coordinates, and branch administrators',
                ),

                // 2. 5 STATS CARDS IN A ROW
                _buildStatsRow(
                  total: total,
                  active: active,
                  inactive: inactive,
                  totalStudents: totalStudents,
                  totalStaff: totalStaff,
                  screenWidth: constraints.maxWidth,
                ),
                const SizedBox(height: 20),

                // 3. TOOLBAR (Search, Status Filter, Showing X, Export CSV, Add Branch)
                _buildToolbar(filtered.length),
                const SizedBox(height: 14),

                // 4. BRANCHES TABLE
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
    required int inactive,
    required int totalStudents,
    required int totalStaff,
    required double screenWidth,
  }) {
    final cards = [
      _buildStatCard('Total Branches', total.toString(), Icons.business_rounded, const Color(0xFF0F172A), const Color(0xFF0F172A)),
      _buildStatCard('Active Branches', active.toString(), Icons.check_circle_rounded, const Color(0xFF10B981), const Color(0xFF0F172A)),
      _buildStatCard('Inactive Branches', inactive.toString(), Icons.cancel_rounded, const Color(0xFFEF4444), const Color(0xFF0F172A)),
      _buildStatCard('Total Students', totalStudents.toString(), Icons.school_rounded, const Color(0xFFA855F7), const Color(0xFF0F172A)),
      _buildStatCard('Total Staff', totalStaff.toString(), Icons.people_alt_rounded, const Color(0xFFF97316), const Color(0xFF0F172A)),
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

  Widget _buildStatCard(String label, String value, IconData icon, Color valueColor, Color iconColor) {
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
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 20),
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
                  ),
                  maxLines: 1,
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
  // TOOLBAR (SEARCH, STATUS DROPDOWN, SHOWING X, EXPORT, ADD)
  // =========================================================================
  Widget _buildToolbar(int count) {
    return Wrap(
      spacing: 12,
      runSpacing: 10,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Left: Search + Status Dropdown + Count
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
                  hintText: 'Search by name, code, contac...',
                  hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  prefixIcon: Icon(Icons.search_rounded, size: 16, color: Color(0xFF94A3B8)),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                ),
                onChanged: (v) {
                  setState(() => _search = v);
                },
              ),
            ),

            // Status Dropdown
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
                  const statusItems = [
                    DropdownMenuItem(value: '', child: Text('All Statuses')),
                    DropdownMenuItem(value: 'active', child: Text('Active Only')),
                    DropdownMenuItem(value: 'inactive', child: Text('Inactive Only')),
                  ];
                  final safeStatus = statusItems.any((i) => i.value == _statusFilter) ? _statusFilter : '';

                  return DropdownButton<String>(
                    value: safeStatus,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                    items: statusItems,
                    onChanged: (val) {
                      setState(() => _statusFilter = val ?? '');
                    },
                  );
                }),
              ),
            ),

            // Showing X branches text
            Text(
              'Showing $count branches',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),

        // Right: Export CSV + Add Branch
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF1E293B),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              ),
              onPressed: _exportCSV,
              icon: const Icon(Icons.download_rounded, size: 16, color: Color(0xFF1E293B)),
              label: const Text('Export CSV', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 10),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              ),
              onPressed: () => _showBranchDialog(),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add Branch', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ],
    );
  }

  // =========================================================================
  // BRANCHES TABLE (MATCHING THE SCREENSHOT EXACTLY)
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
              Icon(Icons.business_rounded, size: 36, color: Color(0xFF94A3B8)),
              SizedBox(height: 8),
              Text('No branches found', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              SizedBox(height: 4),
              Text('Create your first organisation branch to manage classes and attendance', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
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
                      SizedBox(width: 170, child: Text('BRANCH NAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 80, child: Text('CODE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 120, child: Text('CONTACT PERSON', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 170, child: Text('PHONE / EMAIL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 140, child: Text('GEOFENCE GPS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 90, child: Text('CLASSES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 80, child: Text('STUDENTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 80, child: Text('STAFF', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 90, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 60, child: Text('ACTIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),

                // Data Rows
                for (final b in list) ...[
                  _buildBranchRow(b),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBranchRow(dynamic b) {
    final name = (b['name'] ?? 'Branch').toString();
    final address = (b['address'] ?? '').toString();
    final code = (b['code'] ?? '—').toString();
    final contact = (b['contact_person'] ?? '—').toString();
    final phone = (b['phone'] ?? '').toString();
    final email = (b['email'] ?? '').toString();
    final lat = b['latitude'];
    final lng = b['longitude'];
    final radius = b['geofence_radius'] ?? 100;
    final classes = b['class_count'] ?? 0;
    final students = b['student_count'] ?? 0;
    final staff = b['staff_count'] ?? 0;
    final isActive = b['is_active'] == true || b['is_active'] == 1;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. BRANCH NAME + Address
          SizedBox(
            width: 170,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (address.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 12, color: Color(0xFF64748B)),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(
                          address,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // 2. CODE
          SizedBox(
            width: 80,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  code,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ),
            ),
          ),

          // 3. CONTACT PERSON
          SizedBox(
            width: 120,
            child: Text(
              contact,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: Color(0xFF1E293B)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),

          // 4. PHONE / EMAIL
          SizedBox(
            width: 170,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (phone.isNotEmpty)
                  Row(
                    children: [
                      const Icon(Icons.phone_outlined, size: 12, color: Color(0xFF0F172A)),
                      const SizedBox(width: 4),
                      Text(phone, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                    ],
                  ),
                if (email.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.mail_outline_rounded, size: 12, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          email,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // 5. GEOFENCE GPS
          SizedBox(
            width: 140,
            child: (lat != null && lng != null)
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.location_on, size: 12, color: Color(0xFF0F172A)),
                          const SizedBox(width: 3),
                          Text(
                            '${double.tryParse(lat.toString())?.toStringAsFixed(4) ?? lat}, ${double.tryParse(lng.toString())?.toStringAsFixed(4) ?? lng}',
                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: Color(0xFF1E293B)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 1),
                      Text('Radius: ${radius}m', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                    ],
                  )
                : Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(4)),
                      child: const Text('Not set', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ),
                  ),
          ),

          // 6. CLASSES
          SizedBox(
            width: 90,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F3FF),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$classes classes',
                  style: const TextStyle(color: Color(0xFF7C3AED), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),

          // 7. STUDENTS
          SizedBox(
            width: 80,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$students',
                  style: const TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),

          // 8. STAFF
          SizedBox(
            width: 80,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$staff',
                  style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),

          // 9. STATUS
          SizedBox(
            width: 90,
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

          // 10. ACTIONS (Eye Button)
          SizedBox(
            width: 60,
            child: Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                onTap: () => _openBranchDetails(b),
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
}

// =========================================================================
// VIEW BRANCH DETAILS DIALOG
// =========================================================================
class _BranchDetailsDialog extends StatefulWidget {
  final dynamic branchSummary;
  final ApiService api;
  final VoidCallback onRefreshNeeded;
  final Function(Map<String, dynamic>) onEditRequested;

  const _BranchDetailsDialog({
    required this.branchSummary,
    required this.api,
    required this.onRefreshNeeded,
    required this.onEditRequested,
  });

  @override
  State<_BranchDetailsDialog> createState() => _BranchDetailsDialogState();
}

class _BranchDetailsDialogState extends State<_BranchDetailsDialog> {
  bool _isLoading = true;
  Map<String, dynamic>? _details;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    final branchId = widget.branchSummary['id'];
    try {
      final res = await widget.api.getBranchDetails(branchId);
      if (mounted) {
        setState(() {
          _details = res;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _toggleStatus() async {
    final b = _details?['branch'] ?? widget.branchSummary;
    final currentActive = b['is_active'] == true || b['is_active'] == 1;
    final nextActive = !currentActive;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Status Change'),
        content: Text('Are you sure you want to ${nextActive ? "activate" : "deactivate"} branch "${b['name']}"?'),
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
        await widget.api.updateBranch(b['id'], {'isActive': nextActive});
        widget.onRefreshNeeded();
        _fetchDetails();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  Future<void> _deleteBranch() async {
    final b = _details?['branch'] ?? widget.branchSummary;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Branch?'),
        content: Text('Are you sure you want to delete branch "${b['name']}"? This action cannot be undone.'),
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
        await widget.api.deleteBranch(b['id']);
        if (!mounted) return;
        Navigator.pop(context);
        widget.onRefreshNeeded();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Branch deleted successfully.')),
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = _details?['branch'] ?? widget.branchSummary;
    final classesList = (_details?['classes'] as List?) ?? [];
    final staffList = (_details?['staff'] as List?) ?? [];
    final studentsList = (_details?['students'] as List?) ?? [];
    final adminsList = (_details?['admins'] as List?) ?? [];

    final isActive = b['is_active'] == true || b['is_active'] == 1;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: Colors.white,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
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
                      child: const Icon(Icons.business_rounded, color: Color(0xFF4F46E5), size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Branch Details: ${b['name'] ?? ''}',
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

                if (_isLoading)
                  const SizedBox(
                    height: 180,
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5))),
                  )
                else ...[
                  // Info Box
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
                            Expanded(child: _buildDetailField('Branch Code', b['code'] ?? '—', isCode: true)),
                            Expanded(child: _buildDetailField('Status', isActive ? 'Active' : 'Inactive', isStatus: true, isActive: isActive)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(child: _buildDetailField('Contact Person', b['contact_person'] ?? '—')),
                            Expanded(child: _buildDetailField('Phone', b['phone'] ?? '—')),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(child: _buildDetailField('Email', b['email'] ?? '—')),
                            Expanded(
                              child: _buildDetailField(
                                'Geofence GPS',
                                b['latitude'] != null ? '${b['latitude']}, ${b['longitude']} (${b['geofence_radius'] ?? 100}m)' : 'Not set',
                              ),
                            ),
                          ],
                        ),
                        if (b['address'] != null && b['address'].toString().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(child: _buildDetailField('Address', b['address'])),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

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
                        onPressed: () => widget.onEditRequested(Map<String, dynamic>.from(b)),
                        icon: const Icon(Icons.edit_outlined, size: 15, color: Color(0xFF1E293B)),
                        label: const Text('Edit Branch', style: TextStyle(fontSize: 12, color: Color(0xFF1E293B))),
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
                        label: Text(isActive ? 'Deactivate Branch' : 'Activate Branch', style: const TextStyle(fontSize: 12)),
                      ),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFEE2E2),
                          foregroundColor: const Color(0xFFDC2626),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: _deleteBranch,
                        icon: const Icon(Icons.delete_outline_rounded, size: 15),
                        label: const Text('Delete Branch', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Quick summary badges
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _buildSummaryBadge('${classesList.length} Classes', const Color(0xFFF5F3FF), const Color(0xFF7C3AED)),
                      _buildSummaryBadge('${staffList.length} Staff Members', const Color(0xFFECFDF5), const Color(0xFF10B981)),
                      _buildSummaryBadge('${studentsList.length} Students', const Color(0xFFEFF6FF), const Color(0xFF2563EB)),
                      _buildSummaryBadge('${adminsList.length} Branch Admins', const Color(0xFFFFFBEB), const Color(0xFFD97706)),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Branch Administrators Section
                  Text(
                    'Branch Administrators (${adminsList.length})',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),

                  if (adminsList.isEmpty)
                    const Text('No administrators specifically assigned to this branch.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B)))
                  else
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        children: [
                          Container(
                            color: const Color(0xFFF8FAFC),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            child: const Row(
                              children: [
                                Expanded(child: Text('Username', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)))),
                                Expanded(child: Text('Full Name', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)))),
                                Expanded(child: Text('Email', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)))),
                                SizedBox(width: 60, child: Text('Role', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)))),
                              ],
                            ),
                          ),
                          for (final a in adminsList)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              child: Row(
                                children: [
                                  Expanded(child: Text(a['username'] ?? '', style: const TextStyle(fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.w600))),
                                  Expanded(child: Text(a['full_name'] ?? '—', style: const TextStyle(fontSize: 12))),
                                  Expanded(child: Text(a['email'] ?? '—', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
                                  SizedBox(
                                    width: 60,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(color: const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(4)),
                                      child: Text(a['role'] ?? 'admin', style: const TextStyle(fontSize: 10, color: Color(0xFF7C3AED), fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                ],

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

  Widget _buildDetailField(String label, String value, {bool isCode = false, bool isStatus = false, bool isActive = true}) {
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
              fontFamily: isCode ? 'monospace' : null,
              color: const Color(0xFF0F172A),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }

  Widget _buildSummaryBadge(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11.5, fontWeight: FontWeight.bold)),
    );
  }
}
