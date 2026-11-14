import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

class TimetableSetupScreen extends StatefulWidget {
  const TimetableSetupScreen({super.key});

  @override
  State<TimetableSetupScreen> createState() => _TimetableSetupScreenState();
}

class _TimetableSetupScreenState extends State<TimetableSetupScreen> {
  late final ApiService _api;
  List<Map<String, dynamic>> _slots = [];
  bool _isLoading = true;
  bool _isSaving = false;
  String _attendanceMode = 'morning_only'; // 'morning_only' or 'period_wise'

  @override
  void initState() {
    super.initState();
    _api = ApiService(StorageService());
    _loadTimetable();
  }

  Future<void> _loadTimetable() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final res = await _api.getOrgDefaultTimetable();
      if (res['slots'] is List) {
        _slots = List<Map<String, dynamic>>.from(res['slots']);
      } else {
        // Default standard timetable slots if none defined yet
        _slots = [
          {'name': 'Morning Assembly', 'startTime': '08:30', 'endTime': '09:00', 'type': 'assembly'},
          {'name': 'Period 1', 'startTime': '09:00', 'endTime': '09:45', 'type': 'period'},
          {'name': 'Period 2', 'startTime': '09:45', 'endTime': '10:30', 'type': 'period'},
          {'name': 'Short Break', 'startTime': '10:30', 'endTime': '10:45', 'type': 'break'},
          {'name': 'Period 3', 'startTime': '10:45', 'endTime': '11:30', 'type': 'period'},
          {'name': 'Period 4', 'startTime': '11:30', 'endTime': '12:15', 'type': 'period'},
          {'name': 'Lunch Break', 'startTime': '12:15', 'endTime': '13:00', 'type': 'lunch'},
          {'name': 'Period 5', 'startTime': '13:00', 'endTime': '13:45', 'type': 'period'},
          {'name': 'Period 6', 'startTime': '13:45', 'endTime': '14:30', 'type': 'period'},
        ];
      }

      if (res['attendanceMode'] != null) {
        _attendanceMode = res['attendanceMode'];
      }
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showAddSlotDialog() {
    final nameCtrl = TextEditingController();
    final startCtrl = TextEditingController(text: '09:00');
    final endCtrl = TextEditingController(text: '09:45');
    String type = 'period';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          title: const Text('Add Timetable Slot'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Slot / Period Name *', hintText: 'e.g. Period 7'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: startCtrl,
                      decoration: const InputDecoration(labelText: 'Start Time (HH:MM)', hintText: '09:00'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: endCtrl,
                      decoration: const InputDecoration(labelText: 'End Time (HH:MM)', hintText: '09:45'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Slot Type'),
                items: const [
                  DropdownMenuItem(value: 'period', child: Text('Academic Class Period')),
                  DropdownMenuItem(value: 'break', child: Text('Recess / Short Break')),
                  DropdownMenuItem(value: 'lunch', child: Text('Lunch Break')),
                  DropdownMenuItem(value: 'assembly', child: Text('Morning Assembly')),
                ],
                onChanged: (v) {
                  if (v != null) setDlgState(() => type = v);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                if (name.isEmpty) return;

                setState(() {
                  _slots.add({
                    'name': name,
                    'startTime': startCtrl.text.trim(),
                    'endTime': endCtrl.text.trim(),
                    'type': type,
                  });
                });
                Navigator.pop(ctx);
              },
              child: const Text('Add Slot'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveTimetable() async {
    setState(() => _isSaving = true);
    try {
      await _api.saveOrgDefaultTimetable({
        'slots': _slots,
        'attendanceMode': _attendanceMode,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Timetable setup saved successfully!'), backgroundColor: AppTheme.success),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Save error: $e')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Timetable & Periods Setup'),
        actions: [
          TextButton.icon(
            icon: _isSaving
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save_rounded, size: 18),
            label: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: _isSaving ? null : _saveTimetable,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSlotDialog,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Slot'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadTimetable,
              color: AppTheme.primary,
              child: ListView(
                padding: const EdgeInsets.only(left: 14, right: 14, top: 14, bottom: 84),
                children: [
                  // Attendance Mode Configuration Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.tune_rounded, color: AppTheme.primary, size: 20),
                              SizedBox(width: 8),
                              Text('Daily Attendance Mode', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                            ],
                          ),
                          const SizedBox(height: 12),
                          RadioListTile<String>(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Morning Daily Session (Standard)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            subtitle: const Text('Take attendance once at arrival for the entire day', style: TextStyle(fontSize: 12)),
                            value: 'morning_only',
                            groupValue: _attendanceMode,
                            activeColor: AppTheme.primary,
                            onChanged: (v) {
                              if (v != null) setState(() => _attendanceMode = v);
                            },
                          ),
                          const Divider(height: 16),
                          RadioListTile<String>(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Period-Wise Tracking (Multi-Session)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            subtitle: const Text('Allow teachers to mark attendance each subject period', style: TextStyle(fontSize: 12)),
                            value: 'period_wise',
                            groupValue: _attendanceMode,
                            activeColor: AppTheme.primary,
                            onChanged: (v) {
                              if (v != null) setState(() => _attendanceMode = v);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Slots List Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${_slots.length} Daily Slots Configured',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Slots List
                  ..._slots.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final slot = entry.value;
                    final isBreak = slot['type'] == 'break' || slot['type'] == 'lunch';
                    final isAssembly = slot['type'] == 'assembly';

                    Color badgeColor = AppTheme.primary;
                    if (isBreak) badgeColor = AppTheme.warning;
                    if (isAssembly) badgeColor = AppTheme.purpleBadge;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: badgeColor.withValues(alpha: 0.12),
                          child: Icon(
                            isBreak ? Icons.coffee_rounded : isAssembly ? Icons.campaign_rounded : Icons.menu_book_rounded,
                            color: badgeColor,
                            size: 20,
                          ),
                        ),
                        title: Text(slot['name'] ?? 'Period', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text(
                          '${slot['startTime']} – ${slot['endTime']} • ${(slot['type'] ?? "period").toString().toUpperCase()}',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.danger, size: 20),
                          onPressed: () {
                            setState(() => _slots.removeAt(idx));
                          },
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
