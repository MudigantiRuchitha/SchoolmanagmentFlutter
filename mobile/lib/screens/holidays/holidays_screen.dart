import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

class HolidaysScreen extends StatefulWidget {
  const HolidaysScreen({super.key});

  @override
  State<HolidaysScreen> createState() => _HolidaysScreenState();
}

class _HolidaysScreenState extends State<HolidaysScreen> {
  late final ApiService _api;
  List<dynamic> _holidays = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
    _loadHolidays();
  }

  Future<void> _loadHolidays() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _api.getHolidays();
      setState(() {
        _holidays = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showHolidayDialog([Map<String, dynamic>? holiday]) {
    final isEdit = holiday != null;
    final titleCtrl = TextEditingController(text: holiday?['title'] ?? '');
    final startCtrl = TextEditingController(
      text:
          holiday?['start_date'] ?? DateTime.now().toString().split(' ').first,
    );
    final endCtrl = TextEditingController(
      text: holiday?['end_date'] ?? DateTime.now().toString().split(' ').first,
    );
    final descCtrl = TextEditingController(text: holiday?['description'] ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? 'Edit Holiday' : 'Add School Holiday'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Holiday Title *',
                hintText: 'e.g. Diwali Holiday',
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: startCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Start Date (YYYY-MM-DD)',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: endCtrl,
                    decoration: const InputDecoration(
                      labelText: 'End Date (YYYY-MM-DD)',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
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
              final title = titleCtrl.text.trim();
              if (title.isEmpty) return;

              final payload = {
                'title': title,
                'startDate': startCtrl.text.trim(),
                'endDate': endCtrl.text.trim(),
                'description': descCtrl.text.trim(),
              };

              final messenger = ScaffoldMessenger.of(context);
              Navigator.pop(ctx);
              try {
                if (isEdit) {
                  await _api.updateHoliday(holiday['id'], payload);
                } else {
                  await _api.createHoliday(payload);
                }
                _loadHolidays();
              } catch (e) {
                messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: Text(isEdit ? 'Update' : 'Save'),
          ),
        ],
      ),
    );
  }

  void _deleteHoliday(dynamic holiday) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Holiday?'),
        content: Text('Remove holiday "${holiday['title']}"?'),
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
        await _api.deleteHoliday(holiday['id']);
        _loadHolidays();
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
      appBar: AppBar(title: const Text('Holidays Calendar')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showHolidayDialog(),
        icon: const Icon(Icons.beach_access_rounded),
        label: const Text('New Holiday'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadHolidays,
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
            : _holidays.isEmpty
            ? const Center(child: Text('No holidays scheduled.'))
            : ListView.separated(
                padding: const EdgeInsets.only(
                  left: 14,
                  right: 14,
                  top: 14,
                  bottom: 84,
                ),
                itemCount: _holidays.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, idx) {
                  final h = _holidays[idx];
                  return Card(
                    child: ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.warningLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.beach_access_rounded,
                          color: AppTheme.warning,
                        ),
                      ),
                      title: Text(
                        h['title'] ?? 'Holiday',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 2),
                          Text(
                            '${h['start_date']} → ${h['end_date'] ?? h['start_date']}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (h['description'] != null &&
                              h['description'].toString().isNotEmpty)
                            Text(
                              h['description'],
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
                            onPressed: () => _showHolidayDialog(h),
                          ),
                          IconButton(
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              size: 18,
                              color: AppTheme.danger,
                            ),
                            onPressed: () => _deleteHoliday(h),
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
