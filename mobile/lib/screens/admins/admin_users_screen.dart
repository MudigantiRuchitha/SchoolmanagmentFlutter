import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  late final ApiService _api;
  List<dynamic> _admins = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
    _loadAdmins();
  }

  Future<void> _loadAdmins() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _api.getAdmins();
      setState(() {
        _admins = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showAdminDialog([Map<String, dynamic>? admin]) {
    final isEdit = admin != null;
    final userCtrl = TextEditingController(text: admin?['username'] ?? '');
    final passCtrl = TextEditingController();
    final nameCtrl = TextEditingController(text: admin?['full_name'] ?? '');
    final emailCtrl = TextEditingController(text: admin?['email'] ?? '');
    String role = admin?['role'] ?? 'admin';
    String branchAccess = admin?['branch_access'] ?? 'all';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          title: Text(isEdit ? 'Edit Admin User' : 'New Admin Account'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: userCtrl,
                  decoration: const InputDecoration(labelText: 'Username *'),
                  enabled: !isEdit,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: passCtrl,
                  decoration: InputDecoration(
                    labelText: isEdit
                        ? 'New Password (leave empty to keep)'
                        : 'Password *',
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Full Name *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email Address'),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                    DropdownMenuItem(
                      value: 'principal',
                      child: Text('Principal'),
                    ),
                    DropdownMenuItem(
                      value: 'management',
                      child: Text('Management'),
                    ),
                  ],
                  onChanged: (v) {
                    if (v != null) setDlgState(() => role = v);
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: branchAccess,
                  decoration: const InputDecoration(labelText: 'Branch Access'),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All Branches')),
                  ],
                  onChanged: (v) {
                    if (v != null) setDlgState(() => branchAccess = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final u = userCtrl.text.trim();
                final n = nameCtrl.text.trim();
                final p = passCtrl.text.trim();

                if (u.isEmpty || n.isEmpty || (!isEdit && p.isEmpty)) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Please fill all required fields'),
                    ),
                  );
                  return;
                }

                final payload = <String, dynamic>{
                  'username': u,
                  'fullName': n,
                  'email': emailCtrl.text.trim(),
                  'role': role,
                  'branchAccess': branchAccess,
                };
                if (p.isNotEmpty) payload['password'] = p;

                Navigator.pop(ctx);
                try {
                  if (isEdit) {
                    await _api.updateAdmin(admin['id'], payload);
                  } else {
                    await _api.createAdmin(payload);
                  }
                  _loadAdmins();
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Admin account saved successfully!'),
                      backgroundColor: AppTheme.success,
                    ),
                  );
                } catch (e) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Error: $e')));
                }
              },
              child: Text(isEdit ? 'Update' : 'Create'),
            ),
          ],
        ),
      ),
    );
  }

  void _deleteAdmin(dynamic admin) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Admin?'),
        content: Text(
          'Revoke administrator access for "${admin['username']}"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.deleteAdmin(admin['id']);
        _loadAdmins();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin Users & Privileges')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAdminDialog(),
        icon: const Icon(Icons.admin_panel_settings_rounded),
        label: const Text('New Admin'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadAdmins,
        color: AppTheme.primary,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
            ? Center(
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.danger),
                ),
              )
            : _admins.isEmpty
            ? const Center(child: Text('No admin users found.'))
            : ListView.separated(
                padding: const EdgeInsets.only(
                  left: 14,
                  right: 14,
                  top: 14,
                  bottom: 84,
                ),
                itemCount: _admins.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, idx) {
                  final a = _admins[idx];
                  return Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      leading: const CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(
                          Icons.admin_panel_settings_rounded,
                          color: AppTheme.primary,
                        ),
                      ),
                      title: Text(
                        a['full_name'] ?? a['username'] ?? 'Admin',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 2),
                          Text(
                            '@${a['username']} • Role: ${(a['role'] ?? "admin").toUpperCase()}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          if (a['email'] != null &&
                              a['email'].toString().isNotEmpty)
                            Text(
                              a['email'],
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.textMuted,
                              ),
                            ),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            onPressed: () => _showAdminDialog(a),
                          ),
                          IconButton(
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              size: 18,
                              color: AppTheme.danger,
                            ),
                            onPressed: () => _deleteAdmin(a),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
