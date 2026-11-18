import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../models/notice_model.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

class NoticesScreen extends StatefulWidget {
  const NoticesScreen({super.key});

  @override
  State<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends State<NoticesScreen> {
  late final ApiService _api;
  List<SchoolNotice> _notices = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
    _loadNotices();
  }

  Future<void> _loadNotices() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final raw = await _api.getNotices();
      setState(() {
        _notices = raw
            .map((n) => SchoolNotice.fromJson(n as Map<String, dynamic>))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showCreateNoticeDialog() {
    final titleController = TextEditingController();
    final contentController = TextEditingController();
    String targetType = 'all';
    bool isImportant = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.add_circle_outline_rounded, color: AppTheme.primary),
              SizedBox(width: 8),
              Text('Publish Notice', style: TextStyle(fontSize: 18)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(
                    labelText: 'Notice Title *',
                    hintText: 'e.g. Annual Sports Day Circular',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: targetType,
                  decoration: const InputDecoration(
                    labelText: 'Target Audience',
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'all',
                      child: Text('All (School-Wide)'),
                    ),
                    DropdownMenuItem(value: 'staff', child: Text('Staff Only')),
                    DropdownMenuItem(
                      value: 'students',
                      child: Text('Students Only'),
                    ),
                  ],
                  onChanged: (v) {
                    if (v != null) setDialogState(() => targetType = v);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: contentController,
                  decoration: const InputDecoration(
                    labelText: 'Content / Message *',
                    hintText: 'Detailed description...',
                  ),
                  maxLines: 4,
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Mark as High Priority / Important',
                    style: TextStyle(fontSize: 13),
                  ),
                  value: isImportant,
                  activeColor: AppTheme.danger,
                  onChanged: (v) =>
                      setDialogState(() => isImportant = v ?? false),
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
                final title = titleController.text.trim();
                final content = contentController.text.trim();

                if (title.isEmpty || content.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Title and content are required.'),
                    ),
                  );
                  return;
                }

                Navigator.pop(ctx);
                try {
                  await _api.createNotice(
                    title: title,
                    content: content,
                    targetType: targetType,
                    isImportant: isImportant,
                  );
                  _loadNotices();
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Notice published successfully!'),
                      backgroundColor: AppTheme.success,
                    ),
                  );
                } catch (e) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to publish: $e'),
                      backgroundColor: AppTheme.danger,
                    ),
                  );
                }
              },
              child: const Text('Publish'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notices & Circulars')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateNoticeDialog,
        icon: const Icon(Icons.campaign_rounded),
        label: const Text('New Notice'),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: _loadNotices,
        color: AppTheme.primary,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      size: 48,
                      color: AppTheme.danger,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage!,
                      style: const TextStyle(color: AppTheme.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadNotices,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            : _notices.isEmpty
            ? const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.announcement_outlined,
                      size: 52,
                      color: AppTheme.textMuted,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'No notices currently published.',
                      style: TextStyle(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 16,
                  bottom: 88,
                ),
                itemCount: _notices.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (ctx, idx) {
                  final n = _notices[idx];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  n.title,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                              ),
                              if (n.isImportant)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFEBEE),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    'IMPORTANT',
                                    style: TextStyle(
                                      color: AppTheme.danger,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            n.content,
                            style: const TextStyle(
                              fontSize: 13,
                              height: 1.4,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.people_outline_rounded,
                                    size: 14,
                                    color: AppTheme.textMuted,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Target: ${(n.targetType ?? "all").toUpperCase()}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppTheme.textMuted,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                              if (n.createdAt != null)
                                Text(
                                  n.createdAt!.split('T').first,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.textMuted,
                                  ),
                                ),
                            ],
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
