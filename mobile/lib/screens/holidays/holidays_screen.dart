import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../notices/notices_screen.dart';
import '../settings/settings_screen.dart';

class HolidaysScreen extends StatefulWidget {
  const HolidaysScreen({super.key});

  @override
  State<HolidaysScreen> createState() => _HolidaysScreenState();
}

class _HolidaysScreenState extends State<HolidaysScreen> {
  final ApiService _api = ApiService(StorageService());

  List<dynamic> _holidays = [];
  bool _isLoading = true;
  String _filterType = ''; // '' = all, 'national', 'regional', 'org'
  int _currentYear = DateTime.now().year;
  int _currentMonth = DateTime.now().month;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _fetchHolidays();
  }

  Future<void> _fetchHolidays() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.getHolidays({'year': _currentYear});
      if (mounted) {
        setState(() {
          _holidays = res;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> get _filteredHolidays {
    return _holidays.where((h) {
      if (_filterType.isEmpty) return true;
      return (h['type'] ?? '').toString().toLowerCase() == _filterType.toLowerCase();
    }).toList();
  }

  // =========================================================================
  // ADD / EDIT HOLIDAY MODAL
  // =========================================================================
  void _showHolidayModal([Map<String, dynamic>? holiday]) {
    final isEdit = holiday != null;
    final nameCtrl = TextEditingController(text: holiday?['name'] ?? '');
    final descCtrl = TextEditingController(text: holiday?['description'] ?? '');
    DateTime holidayDate = holiday?['date'] != null
        ? (DateTime.tryParse(holiday!['date'].toString()) ?? DateTime.now())
        : _selectedDate;
    String selectedType = holiday?['type'] ?? 'national';

    String? dialogError;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: Colors.white,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(8)),
                          child: Icon(isEdit ? Icons.edit_calendar_rounded : Icons.calendar_today_rounded, color: const Color(0xFF4F46E5), size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            isEdit ? 'Edit Holiday' : 'Add New Holiday',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                          ),
                        ),
                        IconButton(icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)), onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                    const SizedBox(height: 16),

                    if (dialogError != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8)),
                        child: Text(dialogError!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
                      ),

                    const Text('Holiday Name *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: nameCtrl,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'e.g. Independence Day, Annual Sports Day',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 14),

                    Row(
                      children: [
                        // Date Picker Button
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Date *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                              const SizedBox(height: 6),
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate: holidayDate,
                                    firstDate: DateTime(_currentYear - 2),
                                    lastDate: DateTime(_currentYear + 2),
                                  );
                                  if (picked != null) setDlgState(() => holidayDate = picked);
                                },
                                icon: const Icon(Icons.event_rounded, size: 16),
                                label: Text(DateFormat('d MMM yyyy').format(holidayDate), style: const TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Type Dropdown
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Holiday Type *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                decoration: BoxDecoration(border: Border.all(color: const Color(0xFFCBD5E1)), borderRadius: BorderRadius.circular(8)),
                                child: DropdownButtonHideUnderline(
                                  child: Builder(builder: (context) {
                                    const typeItems = [
                                      DropdownMenuItem(value: 'national', child: Text('National', style: TextStyle(fontSize: 13))),
                                      DropdownMenuItem(value: 'regional', child: Text('Regional', style: TextStyle(fontSize: 13))),
                                      DropdownMenuItem(value: 'org', child: Text('Organisation', style: TextStyle(fontSize: 13))),
                                    ];
                                    final safeType = typeItems.any((i) => i.value == selectedType) ? selectedType : 'org';

                                    return DropdownButton<String>(
                                      value: safeType,
                                      isExpanded: true,
                                      items: typeItems,
                                      onChanged: (v) {
                                        if (v != null) setDlgState(() => selectedType = v);
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

                    const Text('Description (Optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: descCtrl,
                      maxLines: 2,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Additional details or schedule notes...',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 20),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
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
                                  if (nameCtrl.text.trim().isEmpty) {
                                    setDlgState(() => dialogError = 'Holiday name is required.');
                                    return;
                                  }

                                  setDlgState(() {
                                    isSaving = true;
                                    dialogError = null;
                                  });

                                  try {
                                    final data = {
                                      'name': nameCtrl.text.trim(),
                                      'date': DateFormat('yyyy-MM-dd').format(holidayDate),
                                      'type': selectedType,
                                      'description': descCtrl.text.trim(),
                                    };

                                    if (isEdit) {
                                      await _api.updateHoliday(holiday['id'], data);
                                    } else {
                                      await _api.createHoliday(data);
                                    }

                                    if (mounted) {
                                      Navigator.pop(ctx);
                                      _fetchHolidays();
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(isEdit ? 'Holiday updated successfully!' : 'Holiday created successfully!'),
                                          backgroundColor: const Color(0xFF10B981),
                                        ),
                                      );
                                    }
                                  } catch (e) {
                                    setDlgState(() {
                                      isSaving = false;
                                      dialogError = e.toString();
                                    });
                                  }
                                },
                          child: Text(isSaving ? 'Saving...' : (isEdit ? 'Update Holiday' : 'Add Holiday')),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // =========================================================================
  // MAIN BUILD
  // =========================================================================
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    final filtered = _filteredHolidays;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const CustomAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 940;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. PAGE TITLE & SUBTITLE
                const PageHeaderTitle(
                  title: 'Holidays',
                  subtitle: 'Manage annual school holidays and calendar events',
                ),

                if (isWide)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Left: Calendar Card
                      Expanded(flex: 6, child: _buildCalendarCard()),
                      const SizedBox(width: 20),

                      // Right: Holiday List Card
                      Expanded(flex: 4, child: _buildHolidayListCard(filtered)),
                    ],
                  )
                else
                  Column(
                    children: [
                      _buildCalendarCard(),
                      const SizedBox(height: 20),
                      _buildHolidayListCard(filtered),
                    ],
                  ),
                const SizedBox(height: 40),
              ],
            );
          },
        ),
      ),
    );
  }

  // =========================================================================
  // CALENDAR CARD
  // =========================================================================
  Widget _buildCalendarCard() {
    final monthName = DateFormat('MMMM yyyy').format(DateTime(_currentYear, _currentMonth));

    // Days in current month calculation
    final daysInMonth = DateTime(_currentYear, _currentMonth + 1, 0).day;
    final firstDayWeekday = DateTime(_currentYear, _currentMonth, 1).weekday % 7; // 0=Sun, 1=Mon...

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
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFF1E293B)),
                  SizedBox(width: 8),
                  Text('Holiday Calendar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                ],
              ),
              Row(
                children: [
                  // Prev month
                  IconButton(
                    icon: const Icon(Icons.chevron_left_rounded, size: 20),
                    onPressed: () {
                      setState(() {
                        if (_currentMonth == 1) {
                          _currentMonth = 12;
                          _currentYear--;
                          _fetchHolidays();
                        } else {
                          _currentMonth--;
                        }
                      });
                    },
                  ),
                  Text(
                    monthName,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  // Next month
                  IconButton(
                    icon: const Icon(Icons.chevron_right_rounded, size: 20),
                    onPressed: () {
                      setState(() {
                        if (_currentMonth == 12) {
                          _currentMonth = 1;
                          _currentYear++;
                          _fetchHolidays();
                        } else {
                          _currentMonth++;
                        }
                      });
                    },
                  ),
                  const SizedBox(width: 8),

                  // Year Dropdown
                  Container(
                    height: 32,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: Builder(builder: (context) {
                        final years = <int>{2024, 2025, 2026, 2027, 2028, _currentYear}.toList()..sort();
                        final yearItems = years.map((y) => DropdownMenuItem(value: y, child: Text(y.toString()))).toList();

                        return DropdownButton<int>(
                          value: _currentYear,
                          style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                          items: yearItems,
                          onChanged: (v) {
                            if (v != null) {
                              setState(() => _currentYear = v);
                              _fetchHolidays();
                            }
                          },
                        );
                      }),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Days of week header
          Row(
            children: const [
              Expanded(child: Center(child: Text('SUN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
              Expanded(child: Center(child: Text('MON', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
              Expanded(child: Center(child: Text('TUE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
              Expanded(child: Center(child: Text('WED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
              Expanded(child: Center(child: Text('THU', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
              Expanded(child: Center(child: Text('FRI', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
              Expanded(child: Center(child: Text('SAT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))))),
            ],
          ),
          const SizedBox(height: 12),

          // Calendar Grid
          _buildMonthGrid(daysInMonth, firstDayWeekday),
          const SizedBox(height: 20),

          // Legend at bottom
          Row(
            children: [
              _buildLegendBullet('National', const Color(0xFFEF4444)),
              const SizedBox(width: 16),
              _buildLegendBullet('Regional', const Color(0xFFF59E0B)),
              const SizedBox(width: 16),
              _buildLegendBullet('Org', const Color(0xFF6366F1)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMonthGrid(int daysInMonth, int firstDayWeekday) {
    final cells = <Widget>[];

    // Leading empty slots
    for (int i = 0; i < firstDayWeekday; i++) {
      cells.add(const SizedBox(height: 48));
    }

    // Days 1..daysInMonth
    final now = DateTime.now();
    for (int day = 1; day <= daysInMonth; day++) {
      final cellDate = DateTime(_currentYear, _currentMonth, day);
      final isToday = cellDate.year == now.year && cellDate.month == now.month && cellDate.day == now.day;
      final isSelected = cellDate.year == _selectedDate.year && cellDate.month == _selectedDate.month && cellDate.day == _selectedDate.day;

      // Check holidays on this day
      final dayHolidays = _holidays.where((h) {
        if (h['date'] == null) return false;
        try {
          final dt = DateTime.parse(h['date'].toString());
          return dt.year == cellDate.year && dt.month == cellDate.month && dt.day == cellDate.day;
        } catch (_) {
          return false;
        }
      }).toList();

      cells.add(
        InkWell(
          onTap: () => setState(() => _selectedDate = cellDate),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF6366F1) : (isToday ? const Color(0xFFEEF2FF) : Colors.transparent),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$day',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.w500,
                    color: isSelected ? Colors.white : (isToday ? const Color(0xFF4F46E5) : const Color(0xFF1E293B)),
                  ),
                ),
                if (dayHolidays.isNotEmpty)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: dayHolidays.take(3).map((h) {
                      final type = (h['type'] ?? 'national').toString();
                      Color dotColor = const Color(0xFFEF4444);
                      if (type == 'regional') dotColor = const Color(0xFFF59E0B);
                      if (type == 'org') dotColor = const Color(0xFF6366F1);
                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 1.5, vertical: 2),
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                      );
                    }).toList(),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: cells,
    );
  }

  Widget _buildLegendBullet(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
      ],
    );
  }

  // =========================================================================
  // HOLIDAY LIST CARD
  // =========================================================================
  Widget _buildHolidayListCard(List<dynamic> list) {
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.event_note_rounded, size: 18, color: Color(0xFF1E293B)),
                    const SizedBox(width: 8),
                    Text(
                      'Holiday List ($_currentYear)',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4F46E5),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => _showHolidayModal(),
                  icon: const Icon(Icons.add, size: 14),
                  label: const Text('Add Holiday', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Filter Dropdown
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: DropdownButtonHideUnderline(
                child: Builder(builder: (context) {
                  const filterTypes = [
                    DropdownMenuItem(value: '', child: Text('All Holiday Types')),
                    DropdownMenuItem(value: 'national', child: Text('National Holidays')),
                    DropdownMenuItem(value: 'regional', child: Text('Regional Holidays')),
                    DropdownMenuItem(value: 'org', child: Text('Organisation Holidays')),
                  ];
                  final safeType = filterTypes.any((i) => i.value == _filterType) ? _filterType : '';

                  return DropdownButton<String>(
                    value: safeType,
                    isExpanded: true,
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B)),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                    items: filterTypes,
                    onChanged: (v) => setState(() => _filterType = v ?? ''),
                  );
                }),
              ),
            ),
          ),

          // List or Empty State
          if (_isLoading)
            const SizedBox(
              height: 200,
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5))),
            )
          else if (list.isEmpty)
            Container(
              height: 220,
              alignment: Alignment.center,
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.calendar_today_outlined, size: 36, color: Color(0xFF94A3B8)),
                  SizedBox(height: 10),
                  Text('No holidays found', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: list.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (ctx, idx) {
                final h = list[idx];
                final name = h['name'] ?? 'Holiday';
                final dateStr = h['date'] != null
                    ? DateFormat('d MMM yyyy').format(DateTime.tryParse(h['date'].toString()) ?? DateTime.now())
                    : '—';
                final type = (h['type'] ?? 'national').toString();

                Color typeColor = const Color(0xFFEF4444);
                if (type == 'regional') typeColor = const Color(0xFFF59E0B);
                if (type == 'org') typeColor = const Color(0xFF6366F1);

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 4,
                        height: 36,
                        decoration: BoxDecoration(color: typeColor, borderRadius: BorderRadius.circular(2)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                            const SizedBox(height: 2),
                            Text(dateStr, style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF475569)),
                        onPressed: () => _showHolidayModal(Map<String, dynamic>.from(h)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFEF4444)),
                        onPressed: () async {
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (c) => AlertDialog(
                              title: const Text('Delete Holiday?'),
                              content: Text('Delete holiday "$name"?'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                                  onPressed: () => Navigator.pop(c, true),
                                  child: const Text('Delete'),
                                ),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            try {
                              await _api.deleteHoliday(h['id']);
                              _fetchHolidays();
                            } catch (_) {}
                          }
                        },
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
