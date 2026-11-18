import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/admin_ui.dart';

class TimetableSetupScreen extends StatefulWidget {
  const TimetableSetupScreen({super.key});

  @override
  State<TimetableSetupScreen> createState() => _TimetableSetupScreenState();
}

class _TimetableSetupScreenState extends State<TimetableSetupScreen> {
  final ApiService _api = ApiService(StorageService());
  List<Map<String, dynamic>> _slots = [];
  final TextEditingController _morningNameController = TextEditingController(
    text: 'Morning (AM)',
  );
  final TextEditingController _morningStartController = TextEditingController(
    text: '09:00',
  );
  final TextEditingController _morningEndController = TextEditingController(
    text: '09:30',
  );
  final TextEditingController _eveningNameController = TextEditingController(
    text: 'Evening (PM)',
  );
  final TextEditingController _eveningStartController = TextEditingController(
    text: '15:30',
  );
  final TextEditingController _eveningEndController = TextEditingController(
    text: '16:00',
  );
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;
  String _attendanceMode = 'MORNING_EVENING';

  @override
  void initState() {
    super.initState();
    _loadTimetable();
  }

  Future<void> _loadTimetable() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _api.getOrgDefaultTimetable();
      final rawSlots = res['slots'] is List
          ? (res['slots'] as List)
                .whereType<Map>()
                .map((slot) => Map<String, dynamic>.from(slot))
                .toList()
          : <Map<String, dynamic>>[];
      final mode = (res['attendanceMode'] ?? res['attendance_mode'] ?? '')
          .toString()
          .toUpperCase();
      _attendanceMode = mode.contains('PERIOD')
          ? 'PERIOD_WISE'
          : 'MORNING_EVENING';

      Map<String, dynamic>? findSession(String type, int fallbackIndex) {
        for (final slot in rawSlots) {
          final slotType = (slot['slotType'] ?? slot['slot_type'] ?? '')
              .toString()
              .toLowerCase();
          if (slotType == type) return slot;
        }
        return rawSlots.length > fallbackIndex ? rawSlots[fallbackIndex] : null;
      }

      void updateSession(
        Map<String, dynamic>? slot,
        TextEditingController name,
        TextEditingController start,
        TextEditingController end, {
        required String defaultName,
        required String defaultStart,
        required String defaultEnd,
      }) {
        String timeValue(dynamic value, String fallback) {
          final text = value?.toString() ?? fallback;
          return text.length >= 5 ? text.substring(0, 5) : text;
        }

        name.text = (slot?['slotName'] ?? slot?['slot_name'] ?? defaultName)
            .toString();
        start.text = timeValue(
          slot?['startTime'] ?? slot?['start_time'],
          defaultStart,
        );
        end.text = timeValue(slot?['endTime'] ?? slot?['end_time'], defaultEnd);
      }

      updateSession(
        findSession('morning', 0),
        _morningNameController,
        _morningStartController,
        _morningEndController,
        defaultName: 'Morning (AM)',
        defaultStart: '09:00',
        defaultEnd: '09:30',
      );
      updateSession(
        findSession('evening', 1),
        _eveningNameController,
        _eveningStartController,
        _eveningEndController,
        defaultName: 'Evening (PM)',
        defaultStart: '15:30',
        defaultEnd: '16:00',
      );

      _slots = rawSlots
          .where((slot) {
            final type = (slot['slotType'] ?? slot['slot_type'] ?? '')
                .toString()
                .toLowerCase();
            return type != 'morning' && type != 'evening';
          })
          .map(
            (slot) => {
              'name':
                  slot['name'] ??
                  slot['slotName'] ??
                  slot['slot_name'] ??
                  'Period',
              'startTime': slot['startTime'] ?? slot['start_time'] ?? '09:00',
              'endTime': slot['endTime'] ?? slot['end_time'] ?? '09:45',
              'type':
                  slot['type'] ??
                  slot['slotType'] ??
                  slot['slot_type'] ??
                  'period',
            },
          )
          .toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _morningNameController.dispose();
    _morningStartController.dispose();
    _morningEndController.dispose();
    _eveningNameController.dispose();
    _eveningStartController.dispose();
    _eveningEndController.dispose();
    super.dispose();
  }

  Widget _buildModeCard({
    required String value,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final selected = _attendanceMode == value;
    return InkWell(
      onTap: () => setState(() => _attendanceMode = value),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppTheme.primaryLight : AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppTheme.primary : AppTheme.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: selected ? AppTheme.primary : AppTheme.textSecondary,
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_off_rounded,
              color: selected ? AppTheme.primary : AppTheme.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickTime(TextEditingController controller) async {
    final parts = controller.text.split(':');
    final parsedHour = parts.isNotEmpty ? int.tryParse(parts[0]) ?? 9 : 9;
    final parsedMinute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    final hour = parsedHour.clamp(0, 23).toInt();
    final minute = parsedMinute.clamp(0, 59).toInt();
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: hour, minute: minute),
    );
    if (picked == null) return;
    controller.text =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildSessionCard({
    required String title,
    required Color color,
    required TextEditingController name,
    required TextEditingController start,
    required TextEditingController end,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.access_time_rounded, color: color, size: 19),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    color: color,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: name,
              decoration: const InputDecoration(
                labelText: 'Slot Label Name',
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: start,
                    readOnly: true,
                    onTap: () => _pickTime(start),
                    decoration: const InputDecoration(
                      labelText: 'Start Time',
                      suffixIcon: Icon(Icons.schedule_rounded, size: 18),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: end,
                    readOnly: true,
                    onTap: () => _pickTime(end),
                    decoration: const InputDecoration(
                      labelText: 'End Time',
                      suffixIcon: Icon(Icons.schedule_rounded, size: 18),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  bool _isValidTime(String value) =>
      RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value);

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
                decoration: const InputDecoration(
                  labelText: 'Slot / Period Name *',
                  hintText: 'e.g. Period 7',
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: startCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Start Time (HH:MM)',
                        hintText: '09:00',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: endCtrl,
                      decoration: const InputDecoration(
                        labelText: 'End Time (HH:MM)',
                        hintText: '09:45',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Slot Type'),
                items: const [
                  DropdownMenuItem(
                    value: 'period',
                    child: Text('Academic Class Period'),
                  ),
                  DropdownMenuItem(
                    value: 'break',
                    child: Text('Recess / Short Break'),
                  ),
                  DropdownMenuItem(value: 'lunch', child: Text('Lunch Break')),
                  DropdownMenuItem(
                    value: 'assembly',
                    child: Text('Morning Assembly'),
                  ),
                ],
                onChanged: (v) {
                  if (v != null) setDlgState(() => type = v);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
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
    final List<Map<String, dynamic>> slots;
    if (_attendanceMode == 'MORNING_EVENING') {
      final morningStart = _morningStartController.text;
      final morningEnd = _morningEndController.text;
      final eveningStart = _eveningStartController.text;
      final eveningEnd = _eveningEndController.text;
      if (!_isValidTime(morningStart) ||
          !_isValidTime(morningEnd) ||
          !_isValidTime(eveningStart) ||
          !_isValidTime(eveningEnd) ||
          morningStart.compareTo(morningEnd) >= 0 ||
          eveningStart.compareTo(eveningEnd) >= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Enter valid start and end times for both sessions.'),
          ),
        );
        return;
      }
      slots = [
        {
          'slotType': 'morning',
          'slotNumber': 1,
          'slotName': _morningNameController.text.trim().isEmpty
              ? 'Morning (AM)'
              : _morningNameController.text.trim(),
          'startTime': morningStart,
          'endTime': morningEnd,
          'isActive': true,
        },
        {
          'slotType': 'evening',
          'slotNumber': 2,
          'slotName': _eveningNameController.text.trim().isEmpty
              ? 'Evening (PM)'
              : _eveningNameController.text.trim(),
          'startTime': eveningStart,
          'endTime': eveningEnd,
          'isActive': true,
        },
      ];
    } else {
      slots = _slots.asMap().entries.map((entry) {
        final index = entry.key;
        final slot = entry.value;
        return {
          'slotType': 'period',
          'slotNumber': index + 1,
          'slotName': slot['name'] ?? 'Period ${index + 1}',
          'startTime': slot['startTime'],
          'endTime': slot['endTime'],
          'isActive': true,
        };
      }).toList();
    }

    setState(() => _isSaving = true);
    try {
      await _api.saveOrgDefaultTimetable({
        'slots': slots,
        'attendanceMode': _attendanceMode,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _attendanceMode == 'MORNING_EVENING'
                ? 'Morning and evening session times saved successfully!'
                : 'Period timetable saved successfully!',
          ),
          backgroundColor: AppTheme.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save error: $e')));
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
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.save_rounded, size: 18),
            label: const Text(
              'Save',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            onPressed: _isSaving ? null : _saveTimetable,
          ),
        ],
      ),
      floatingActionButton: _attendanceMode == 'PERIOD_WISE'
          ? FloatingActionButton.extended(
              onPressed: _showAddSlotDialog,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Slot'),
            )
          : null,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppTheme.danger),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _loadTimetable,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Try Again'),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _loadTimetable,
              color: AppTheme.primary,
              child: ListView(
                padding: const EdgeInsets.only(
                  left: 14,
                  right: 14,
                  top: 14,
                  bottom: 84,
                ),
                children: [
                  const AdminPageHeading(
                    title: 'Timetable & Attendance Setup',
                    subtitle: 'Configure the attendance mode and daily timetable slots.',
                    horizontalPadding: 0,
                  ),
                  // Attendance Mode Configuration Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Attendance Mode',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Choose how attendance is recorded across the organization.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _buildModeCard(
                            value: 'MORNING_EVENING',
                            title: 'Morning & Evening (AM / PM)',
                            subtitle: 'Set separate arrival and departure session times.',
                            icon: Icons.wb_sunny_outlined,
                          ),
                          const SizedBox(height: 8),
                          _buildModeCard(
                            value: 'PERIOD_WISE',
                            title: 'Period-wise Tracking',
                            subtitle:
                                'Record attendance for each class period.',
                            icon: Icons.view_timeline_outlined,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (_attendanceMode == 'MORNING_EVENING') ...[
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(14),
                        child: Text(
                          'These session times apply to all classes across the organization.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ),
                    _buildSessionCard(
                      title: 'Morning Session (AM)',
                      color: AppTheme.primary,
                      name: _morningNameController,
                      start: _morningStartController,
                      end: _morningEndController,
                    ),
                    _buildSessionCard(
                      title: 'Evening Session (PM)',
                      color: AppTheme.secondary,
                      name: _eveningNameController,
                      start: _eveningStartController,
                      end: _eveningEndController,
                    ),
                  ] else ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 4,
                      ),
                      child: Text(
                        'Class Period Schedule • ${_slots.length} Slots',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    ..._slots.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final slot = entry.value;
                      final isBreak =
                          slot['type'] == 'break' || slot['type'] == 'lunch';
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
                              isBreak
                                  ? Icons.coffee_rounded
                                  : isAssembly
                                  ? Icons.campaign_rounded
                                  : Icons.menu_book_rounded,
                              color: badgeColor,
                              size: 20,
                            ),
                          ),
                          title: Text(
                            slot['name'] ?? 'Period',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: Text(
                            '${slot['startTime']} – ${slot['endTime']} • ${(slot['type'] ?? "period").toString().toUpperCase()}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          trailing: IconButton(
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              color: AppTheme.danger,
                              size: 20,
                            ),
                            onPressed: () {
                              setState(() => _slots.removeAt(idx));
                            },
                          ),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }
}
