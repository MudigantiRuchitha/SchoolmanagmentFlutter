import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

class BranchGroupsScreen extends StatefulWidget {
  const BranchGroupsScreen({super.key});

  @override
  State<BranchGroupsScreen> createState() => _BranchGroupsScreenState();
}

class _BranchGroupsScreenState extends State<BranchGroupsScreen> {
  late final ApiService _api;
  List<dynamic> _groups = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
    _loadGroups();
  }

  Future<void> _loadGroups() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _api.getBranchGroups();
      setState(() {
        _groups = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showGroupDialog([Map<String, dynamic>? group]) {
    final isEdit = group != null;
    final nameCtrl = TextEditingController(text: group?['name'] ?? '');
    final descCtrl = TextEditingController(text: group?['description'] ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? 'Edit Branch Group' : 'New Branch Group'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Group Name *',
                hintText: 'e.g. North Zone Campuses',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Optional notes',
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;

              final payload = {
                'name': name,
                'description': descCtrl.text.trim(),
              };

              final messenger = ScaffoldMessenger.of(context);
              Navigator.pop(ctx);
              try {
                if (isEdit) {
                  await _api.updateBranchGroup(group['id'], payload);
                } else {
                  await _api.createBranchGroup(payload);
                }
                _loadGroups();
              } catch (e) {
                messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: Text(isEdit ? 'Update' : 'Create'),
          ),
        ],
      ),
    );
  }

  void _deleteGroup(dynamic group) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Group?'),
        content: Text('Delete branch group "${group['name']}"?'),
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
        await _api.deleteBranchGroup(group['id']);
        _loadGroups();
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
      appBar: AppBar(title: const Text('Branch Groups')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showGroupDialog(),
        icon: const Icon(Icons.workspaces_rounded),
        label: const Text('New Group'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadGroups,
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
            : _groups.isEmpty
            ? const Center(child: Text('No branch groups created.'))
            : ListView.separated(
                padding: const EdgeInsets.all(14),
                itemCount: _groups.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, idx) {
                  final g = _groups[idx];
                  return Card(
                    child: ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.workspaces_rounded,
                          color: AppTheme.primary,
                        ),
                      ),
                      title: Text(
                        g['name'] ?? 'Group',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        g['description'] ?? 'No description provided',
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            onPressed: () => _showGroupDialog(g),
                          ),
                          IconButton(
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              size: 18,
                              color: AppTheme.danger,
                            ),
                            onPressed: () => _deleteGroup(g),
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
