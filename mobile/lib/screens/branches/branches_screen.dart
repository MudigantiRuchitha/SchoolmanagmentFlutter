import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

class BranchesScreen extends StatefulWidget {
  const BranchesScreen({super.key});

  @override
  State<BranchesScreen> createState() => _BranchesScreenState();
}

class _BranchesScreenState extends State<BranchesScreen> {
  late final ApiService _api;
  List<dynamic> _branches = [];
  bool _isLoading = true;
  String _search = '';
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _api.getBranches();
      setState(() {
        _branches = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showBranchDialog([Map<String, dynamic>? branch]) {
    final isEdit = branch != null;
    final nameCtrl = TextEditingController(text: branch?['name'] ?? '');
    final codeCtrl = TextEditingController(text: branch?['code'] ?? '');
    final contactCtrl = TextEditingController(text: branch?['contact_person'] ?? '');
    final phoneCtrl = TextEditingController(text: branch?['phone'] ?? '');
    final emailCtrl = TextEditingController(text: branch?['email'] ?? '');
    final addressCtrl = TextEditingController(text: branch?['address'] ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(isEdit ? Icons.edit_rounded : Icons.add_business_rounded, color: AppTheme.primary),
            const SizedBox(width: 8),
            Text(isEdit ? 'Edit Branch' : 'Add New Branch', style: const TextStyle(fontSize: 18)),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Branch Name *', hintText: 'e.g. Main Campus'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: codeCtrl,
                decoration: const InputDecoration(labelText: 'Branch Code *', hintText: 'e.g. MAIN'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: contactCtrl,
                decoration: const InputDecoration(labelText: 'Contact Person', hintText: 'Principal / Admin'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: phoneCtrl,
                decoration: const InputDecoration(labelText: 'Phone Number', hintText: '+91 9876543210'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: emailCtrl,
                decoration: const InputDecoration(labelText: 'Email Address', hintText: 'branch@school.com'),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: addressCtrl,
                decoration: const InputDecoration(labelText: 'Address', hintText: 'Street, City, State'),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              final code = codeCtrl.text.trim();
              if (name.isEmpty || code.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Branch Name and Code are required.')),
                );
                return;
              }

              final payload = {
                'name': name,
                'code': code,
                'contactPerson': contactCtrl.text.trim(),
                'phone': phoneCtrl.text.trim(),
                'email': emailCtrl.text.trim(),
                'address': addressCtrl.text.trim(),
                'isActive': true,
              };

              final messenger = ScaffoldMessenger.of(context);
              Navigator.pop(ctx);
              try {
                if (isEdit) {
                  await _api.updateBranch(branch['id'], payload);
                } else {
                  await _api.createBranch(payload);
                }
                _loadBranches();
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(isEdit ? 'Branch updated successfully!' : 'Branch added successfully!'),
                    backgroundColor: AppTheme.success,
                  ),
                );
              } catch (e) {
                messenger.showSnackBar(
                  SnackBar(content: Text('Error: $e'), backgroundColor: AppTheme.danger),
                );
              }
            },
            child: Text(isEdit ? 'Update' : 'Save'),
          ),
        ],
      ),
    );
  }

  void _deleteBranch(dynamic branch) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Branch?'),
        content: Text('Are you sure you want to remove "${branch['name']}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
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
        await _api.deleteBranch(branch['id']);
        _loadBranches();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Branch deleted successfully.'), backgroundColor: AppTheme.success),
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _branches.where((b) {
      final q = _search.toLowerCase();
      final name = (b['name'] ?? '').toString().toLowerCase();
      final code = (b['code'] ?? '').toString().toLowerCase();
      return name.contains(q) || code.contains(q);
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Branches / Campuses'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showBranchDialog(),
        icon: const Icon(Icons.add_business_rounded),
        label: const Text('New Branch'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadBranches,
        color: AppTheme.primary,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              color: AppTheme.surface,
              child: TextField(
                decoration: InputDecoration(
                  hintText: 'Search branches by name or code...',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _search.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear), onPressed: () => setState(() => _search = ''))
                      : null,
                ),
                onChanged: (v) => setState(() => _search = v),
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _errorMessage != null
                      ? Center(child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.danger)))
                      : filtered.isEmpty
                          ? const Center(child: Text('No branches found.'))
                          : ListView.separated(
                              padding: const EdgeInsets.only(left: 14, right: 14, top: 14, bottom: 84),
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (ctx, idx) {
                                final b = filtered[idx];
                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.all(8),
                                              decoration: BoxDecoration(
                                                color: AppTheme.primaryLight,
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Icon(Icons.business_rounded, color: AppTheme.primary, size: 22),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    b['name'] ?? 'Branch',
                                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                                                  ),
                                                  Text('Code: ${b['code'] ?? "—"}', style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.w600)),
                                                ],
                                              ),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.edit_outlined, size: 20, color: AppTheme.primary),
                                              onPressed: () => _showBranchDialog(b),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppTheme.danger),
                                              onPressed: () => _deleteBranch(b),
                                            ),
                                          ],
                                        ),
                                        const Divider(height: 20),
                                        if (b['contact_person'] != null && b['contact_person'].toString().isNotEmpty) ...[
                                          Row(
                                            children: [
                                              const Icon(Icons.person_outline_rounded, size: 16, color: AppTheme.textMuted),
                                              const SizedBox(width: 6),
                                              Text('Contact: ${b['contact_person']}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                        ],
                                        if (b['phone'] != null && b['phone'].toString().isNotEmpty) ...[
                                          Row(
                                            children: [
                                              const Icon(Icons.phone_outlined, size: 16, color: AppTheme.textMuted),
                                              const SizedBox(width: 6),
                                              Text(b['phone'], style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                        ],
                                        if (b['address'] != null && b['address'].toString().isNotEmpty) ...[
                                          Row(
                                            children: [
                                              const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.textMuted),
                                              const SizedBox(width: 6),
                                              Expanded(child: Text(b['address'], style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary))),
                                            ],
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
