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

class LeaveApprovalsScreen extends StatefulWidget {
  const LeaveApprovalsScreen({super.key});

  @override
  State<LeaveApprovalsScreen> createState() => _LeaveApprovalsScreenState();
}

class _LeaveApprovalsScreenState extends State<LeaveApprovalsScreen> {
  final ApiService _api = ApiService(StorageService());

  List<dynamic> _leaves = [];
  List<dynamic> _leaveTypes = [];
  List<dynamic> _staff = [];

  bool _isLoading = true;
  String _search = '';
  String _statusFilter = ''; // '' = all, 'pending', 'approved', 'rejected'
  String _typeFilter = '';
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
        _api.getLeaves(),
        _api.getLeaveTypes(),
        _api.getStaff(),
      ]);

      if (mounted) {
        setState(() {
          _leaves = results[0];
          _leaveTypes = results[1];
          _staff = results[2];
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

  List<dynamic> get _filteredLeaves {
    return _leaves.where((l) {
      final q = _search.toLowerCase().trim();
      final staffName = (l['staff_name'] ?? l['full_name'] ?? '').toString().toLowerCase();
      final reason = (l['reason'] ?? '').toString().toLowerCase();

      final matchesSearch = q.isEmpty || staffName.contains(q) || reason.contains(q);

      final status = (l['status'] ?? 'pending').toString().toLowerCase();
      final matchesStatus = _statusFilter.isEmpty || status == _statusFilter.toLowerCase();

      final typeName = (l['leave_type_name'] ?? l['leave_type'] ?? '').toString();
      final matchesType = _typeFilter.isEmpty || typeName == _typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    }).toList();
  }

  String _formatDate(dynamic d) {
    if (d == null) return '—';
    try {
      final dt = DateTime.parse(d.toString());
      return DateFormat('d MMM yyyy').format(dt);
    } catch (_) {
      return d.toString();
    }
  }

  int _calculateDays(dynamic from, dynamic to) {
    if (from == null || to == null) return 1;
    try {
      final f = DateTime.parse(from.toString());
      final t = DateTime.parse(to.toString());
      final diff = t.difference(f).inDays + 1;
      return diff > 0 ? diff : 1;
    } catch (_) {
      return 1;
    }
  }

  // =========================================================================
  // VIEW & REVIEW LEAVE DETAILS MODAL
  // =========================================================================
  void _openLeaveDetails(dynamic leave) {
    final status = (leave['status'] ?? 'pending').toString().toLowerCase();
    final remarksCtrl = TextEditingController(text: leave['admin_remarks'] ?? '');
    bool isProcessing = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: Colors.white,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
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
                          child: const Icon(Icons.beach_access_rounded, color: Color(0xFF4F46E5), size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Leave Application Details',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Info Box
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
                          Row(
                            children: [
                              Expanded(child: _buildDetailField('Staff Member', leave['staff_name'] ?? leave['full_name'] ?? '—')),
                              Expanded(child: _buildDetailField('Leave Type', leave['leave_type_name'] ?? leave['leave_type'] ?? '—')),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(child: _buildDetailField('From Date', _formatDate(leave['from_date']))),
                              Expanded(child: _buildDetailField('To Date', _formatDate(leave['to_date']))),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(child: _buildDetailField('Duration', '${_calculateDays(leave['from_date'], leave['to_date'])} Day(s)')),
                              Expanded(child: _buildDetailField('Status', status.toUpperCase(), isStatus: true, status: status)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _buildDetailField('Reason', leave['reason'] ?? 'No reason provided.'),
                          if (leave['reviewed_by'] != null) ...[
                            const SizedBox(height: 10),
                            _buildDetailField('Reviewed By', leave['reviewed_by'].toString()),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Review Remarks Input
                    const Text('Admin Remarks / Comments', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: remarksCtrl,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Enter review comments or remarks...',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 20),

                    // Action Buttons
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton.icon(
                          style: TextButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
                          onPressed: isProcessing
                              ? null
                              : () async {
                                  final confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (c) => AlertDialog(
                                      title: const Text('Delete Leave Request?'),
                                      content: const Text('Are you sure you want to delete this leave application?'),
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
                                    setDlgState(() => isProcessing = true);
                                    try {
                                      await _api.deleteLeave(leave['id']);
                                      if (mounted) {
                                        Navigator.pop(ctx);
                                        _loadData();
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Leave application deleted.')),
                                        );
                                      }
                                    } catch (e) {
                                      setDlgState(() => isProcessing = false);
                                    }
                                  }
                                },
                          icon: const Icon(Icons.delete_outline_rounded, size: 16),
                          label: const Text('Delete'),
                        ),
                        Row(
                          children: [
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEF4444),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              onPressed: isProcessing
                                  ? null
                                  : () async {
                                      setDlgState(() => isProcessing = true);
                                      try {
                                        await _api.updateLeaveStatus(
                                          leaveId: leave['id'],
                                          status: 'rejected',
                                          adminRemarks: remarksCtrl.text.trim(),
                                        );
                                        if (mounted) {
                                          Navigator.pop(ctx);
                                          _loadData();
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Leave request rejected.'), backgroundColor: Color(0xFFEF4444)),
                                          );
                                        }
                                      } catch (_) {
                                        setDlgState(() => isProcessing = false);
                                      }
                                    },
                              icon: const Icon(Icons.close_rounded, size: 16),
                              label: const Text('Reject'),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF10B981),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              onPressed: isProcessing
                                  ? null
                                  : () async {
                                      setDlgState(() => isProcessing = true);
                                      try {
                                        await _api.updateLeaveStatus(
                                          leaveId: leave['id'],
                                          status: 'approved',
                                          adminRemarks: remarksCtrl.text.trim(),
                                        );
                                        if (mounted) {
                                          Navigator.pop(ctx);
                                          _loadData();
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Leave request approved!'), backgroundColor: Color(0xFF10B981)),
                                          );
                                        }
                                      } catch (_) {
                                        setDlgState(() => isProcessing = false);
                                      }
                                    },
                              icon: const Icon(Icons.check_rounded, size: 16),
                              label: const Text('Approve'),
                            ),
                          ],
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

  Widget _buildDetailField(String label, String value, {bool isStatus = false, String? status}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        if (isStatus)
          _buildStatusBadge(status ?? 'pending')
        else
          Text(
            value,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }

  // =========================================================================
  // APPLY LEAVE MODAL
  // =========================================================================
  void _showApplyLeaveModal() {
    String? selectedStaffId;
    String? selectedLeaveTypeId;
    DateTime fromDate = DateTime.now();
    DateTime toDate = DateTime.now();
    final reasonCtrl = TextEditingController();
    String? dialogError;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: Colors.white,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
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
                          child: const Icon(Icons.add_rounded, color: Color(0xFF4F46E5), size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text('Apply Staff Leave', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
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

                    // Staff Member Dropdown
                    const Text('Staff Member *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(border: Border.all(color: const Color(0xFFCBD5E1)), borderRadius: BorderRadius.circular(8)),
                      child: DropdownButtonHideUnderline(
                        child: Builder(builder: (context) {
                          final staffItems = <DropdownMenuItem<String>>[];
                          final seenStaff = <String>{};
                          for (final s in _staff) {
                            final sId = s['id']?.toString().trim() ?? '';
                            if (sId.isNotEmpty && seenStaff.add(sId)) {
                              final name = s['full_name'] ?? s['name'] ?? 'Staff';
                              final desig = s['designation'] ?? '';
                              staffItems.add(
                                DropdownMenuItem(
                                  value: sId,
                                  child: Text('$name ${desig.isNotEmpty ? "($desig)" : ""}', style: const TextStyle(fontSize: 13)),
                                ),
                              );
                            }
                          }
                          final safeStaffId = staffItems.any((i) => i.value == selectedStaffId) ? selectedStaffId : null;

                          return DropdownButton<String>(
                            value: safeStaffId,
                            isExpanded: true,
                            hint: const Text('Select Staff Member', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                            items: staffItems,
                            onChanged: (v) => setDlgState(() => selectedStaffId = v),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Leave Type Dropdown
                    const Text('Leave Type *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(border: Border.all(color: const Color(0xFFCBD5E1)), borderRadius: BorderRadius.circular(8)),
                      child: DropdownButtonHideUnderline(
                        child: Builder(builder: (context) {
                          final typeItems = <DropdownMenuItem<String>>[];
                          final seenTypes = <String>{};
                          for (final t in _leaveTypes) {
                            final tId = t['id']?.toString().trim() ?? '';
                            if (tId.isNotEmpty && seenTypes.add(tId)) {
                              typeItems.add(
                                DropdownMenuItem(
                                  value: tId,
                                  child: Text(t['name'] ?? 'Type', style: const TextStyle(fontSize: 13)),
                                ),
                              );
                            }
                          }
                          final safeTypeId = typeItems.any((i) => i.value == selectedLeaveTypeId) ? selectedLeaveTypeId : null;

                          return DropdownButton<String>(
                            value: safeTypeId,
                            isExpanded: true,
                            hint: const Text('Select Leave Type', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                            items: typeItems,
                            onChanged: (v) => setDlgState(() => selectedLeaveTypeId = v),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Dates Row
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('From Date *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                              const SizedBox(height: 6),
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate: fromDate,
                                    firstDate: DateTime(2025),
                                    lastDate: DateTime(2030),
                                  );
                                  if (picked != null) setDlgState(() => fromDate = picked);
                                },
                                icon: const Icon(Icons.calendar_today_rounded, size: 14),
                                label: Text(DateFormat('d MMM yyyy').format(fromDate), style: const TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('To Date *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                              const SizedBox(height: 6),
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate: toDate,
                                    firstDate: DateTime(2025),
                                    lastDate: DateTime(2030),
                                  );
                                  if (picked != null) setDlgState(() => toDate = picked);
                                },
                                icon: const Icon(Icons.calendar_today_rounded, size: 14),
                                label: Text(DateFormat('d MMM yyyy').format(toDate), style: const TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Reason
                    const Text('Reason *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: reasonCtrl,
                      maxLines: 3,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Reason for leave application...',
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
                                  if (selectedStaffId == null || selectedLeaveTypeId == null || reasonCtrl.text.trim().isEmpty) {
                                    setDlgState(() => dialogError = 'Please fill all required fields.');
                                    return;
                                  }

                                  setDlgState(() {
                                    isSaving = true;
                                    dialogError = null;
                                  });

                                  try {
                                    await _api.applyLeave({
                                      'staffId': int.parse(selectedStaffId!),
                                      'leaveTypeId': int.parse(selectedLeaveTypeId!),
                                      'fromDate': DateFormat('yyyy-MM-dd').format(fromDate),
                                      'toDate': DateFormat('yyyy-MM-dd').format(toDate),
                                      'reason': reasonCtrl.text.trim(),
                                    });

                                    if (mounted) {
                                      Navigator.pop(ctx);
                                      _loadData();
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('Leave application submitted successfully!'),
                                          backgroundColor: Color(0xFF10B981),
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
                          child: Text(isSaving ? 'Submitting...' : 'Apply Leave'),
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
  // MANAGE LEAVE TYPES MODAL
  // =========================================================================
  void _showManageTypesModal() {
    final typeNameCtrl = TextEditingController();
    bool isAdding = false;

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
                          child: const Icon(Icons.tune_rounded, color: Color(0xFF4F46E5), size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text('Manage Leave Types', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                        ),
                        IconButton(icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)), onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Add new type input
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: typeNameCtrl,
                            style: const TextStyle(fontSize: 13),
                            decoration: const InputDecoration(
                              isDense: true,
                              hintText: 'e.g. Maternity Leave, Sick Leave',
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4F46E5),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: isAdding
                              ? null
                              : () async {
                                  if (typeNameCtrl.text.trim().isEmpty) return;
                                  setDlgState(() => isAdding = true);
                                  try {
                                    await _api.createLeaveType({'name': typeNameCtrl.text.trim()});
                                    typeNameCtrl.clear();
                                    final updated = await _api.getLeaveTypes();
                                    setState(() => _leaveTypes = updated);
                                    setDlgState(() => isAdding = false);
                                  } catch (_) {
                                    setDlgState(() => isAdding = false);
                                  }
                                },
                          child: Text(isAdding ? 'Adding...' : '+ Add'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // Existing types list
                    const Text('Existing Leave Types', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 8),

                    if (_leaveTypes.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20),
                        child: Center(child: Text('No leave types configured', style: TextStyle(color: Color(0xFF94A3B8)))),
                      )
                    else
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: _leaveTypes.length,
                          separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                          itemBuilder: (c, idx) {
                            final t = _leaveTypes[idx];
                            return Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              child: Row(
                                children: [
                                  Expanded(child: Text(t['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFEF4444)),
                                    onPressed: () async {
                                      try {
                                        await _api.deleteLeaveType(t['id']);
                                        final updated = await _api.getLeaveTypes();
                                        setState(() => _leaveTypes = updated);
                                        setDlgState(() {});
                                      } catch (_) {}
                                    },
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
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

    final total = _leaves.length;
    final pending = _leaves.where((l) => (l['status'] ?? '').toString().toLowerCase() == 'pending').length;
    final approved = _leaves.where((l) => (l['status'] ?? '').toString().toLowerCase() == 'approved').length;
    final rejected = _leaves.where((l) => (l['status'] ?? '').toString().toLowerCase() == 'rejected').length;

    final filtered = _filteredLeaves;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: Navigator.canPop(context) ? const CustomAppBar() : null,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. PAGE TITLE & SUBTITLE
                const PageHeaderTitle(
                  title: 'Leave Management',
                  subtitle: 'Review staff leave applications, approve/reject requests, and configure leave types',
                ),

                // 2. 4 STAT CARDS ROW
                _buildStatsRow(total: total, pending: pending, approved: approved, rejected: rejected, screenWidth: constraints.maxWidth),
                const SizedBox(height: 20),

                // 3. TOOLBAR (Search, Status Filter, Type Filter, Manage Types, Apply Leave)
                _buildToolbar(),
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
  // 4 STAT CARDS ROW
  // =========================================================================
  Widget _buildStatsRow({
    required int total,
    required int pending,
    required int approved,
    required int rejected,
    required double screenWidth,
  }) {
    final cards = [
      _buildStatCard('Total Requests', total.toString(), Icons.beach_access_rounded, const Color(0xFF0F172A)),
      _buildStatCard('Pending', pending.toString(), Icons.beach_access_rounded, const Color(0xFFF59E0B)),
      _buildStatCard('Approved', approved.toString(), Icons.beach_access_rounded, const Color(0xFF10B981)),
      _buildStatCard('Rejected', rejected.toString(), Icons.beach_access_rounded, const Color(0xFFDC2626)),
    ];

    if (screenWidth >= 880) {
      return Row(
        children: [
          for (int i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(width: 14),
            Expanded(child: cards[i]),
          ],
        ],
      );
    } else {
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: cards.map((c) => SizedBox(width: (screenWidth - 52) / 2, child: c)).toList(),
      );
    }
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
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
          const SizedBox(width: 14),
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
                    color: color,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // TOOLBAR (SEARCH, STATUS, TYPE, MANAGE, APPLY)
  // =========================================================================
  Widget _buildToolbar() {
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
              width: 220,
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
                  hintText: 'Search by staff name...',
                  hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  prefixIcon: Icon(Icons.search_rounded, size: 16, color: Color(0xFF94A3B8)),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                ),
                onChanged: (v) => setState(() => _search = v),
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
                  const statusFilters = [
                    DropdownMenuItem(value: '', child: Text('All Statuses')),
                    DropdownMenuItem(value: 'pending', child: Text('Pending')),
                    DropdownMenuItem(value: 'approved', child: Text('Approved')),
                    DropdownMenuItem(value: 'rejected', child: Text('Rejected')),
                  ];
                  final safeStatus = statusFilters.any((i) => i.value == _statusFilter) ? _statusFilter : '';

                  return DropdownButton<String>(
                    value: safeStatus,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                    items: statusFilters,
                    onChanged: (val) => setState(() => _statusFilter = val ?? ''),
                  );
                }),
              ),
            ),

            // Leave Type Dropdown
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
                  final typeFilters = <DropdownMenuItem<String>>[
                    const DropdownMenuItem(value: '', child: Text('All Leave Types')),
                  ];
                  final seenTypeNames = <String>{''};
                  for (final t in _leaveTypes) {
                    final tName = (t['name'] ?? '').toString().trim();
                    if (tName.isNotEmpty && seenTypeNames.add(tName)) {
                      typeFilters.add(
                        DropdownMenuItem(
                          value: tName,
                          child: Text(tName),
                        ),
                      );
                    }
                  }
                  final safeType = typeFilters.any((i) => i.value == _typeFilter) ? _typeFilter : '';

                  return DropdownButton<String>(
                    value: safeType,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                    items: typeFilters,
                    onChanged: (val) => setState(() => _typeFilter = val ?? ''),
                  );
                }),
              ),
            ),
          ],
        ),

        // Right Action Buttons (Manage Leave Types + Apply Leave)
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
              onPressed: _showManageTypesModal,
              icon: const Icon(Icons.tune_rounded, size: 16, color: Color(0xFF1E293B)),
              label: const Text('Manage Leave Types', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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
              onPressed: _showApplyLeaveModal,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Apply Leave', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
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
              Icon(Icons.beach_access_rounded, size: 36, color: Color(0xFF94A3B8)),
              SizedBox(height: 8),
              Text('No leave requests found', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              SizedBox(height: 4),
              Text('Apply for a leave or adjust your status filters', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
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
            constraints: const BoxConstraints(minWidth: 1050),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Container(
                  color: const Color(0xFFF8FAFC),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: const Row(
                    children: [
                      SizedBox(width: 170, child: Text('STAFF MEMBER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 130, child: Text('LEAVE TYPE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 120, child: Text('FROM DATE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 120, child: Text('TO DATE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 90, child: Text('DAYS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 180, child: Text('REASON', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 110, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 130, child: Text('REVIEW DETAILS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                      SizedBox(width: 80, child: Text('ACTIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)))),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),

                // Rows
                for (final l in list) ...[
                  _buildLeaveRow(l),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLeaveRow(dynamic l) {
    final staffName = (l['staff_name'] ?? l['full_name'] ?? 'Staff Member').toString();
    final roleType = (l['role_type'] ?? 'teaching').toString();
    final branchName = (l['branch_name'] ?? 'manikonda').toString();
    final staffSubtitle = '$roleType ($branchName)';

    final leaveType = (l['leave_type_name'] ?? l['leave_type'] ?? '—').toString();
    final fromDate = _formatDate(l['from_date']);
    final toDate = _formatDate(l['to_date']);
    final days = _calculateDays(l['from_date'], l['to_date']);
    final reason = (l['reason'] ?? '—').toString();
    final status = (l['status'] ?? 'pending').toString().toLowerCase();

    String reviewDetails = '—';
    if (l['reviewed_by_name'] != null && l['reviewed_by_name'].toString().isNotEmpty) {
      reviewDetails = 'By: ${l['reviewed_by_name']}';
    } else if (status != 'pending') {
      reviewDetails = 'By: admin';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. STAFF MEMBER
          SizedBox(
            width: 170,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(staffName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(staffSubtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),

          // 2. LEAVE TYPE
          SizedBox(
            width: 130,
            child: Text(leaveType, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),

          // 3. FROM DATE
          SizedBox(
            width: 120,
            child: Text(fromDate, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B))),
          ),

          // 4. TO DATE
          SizedBox(
            width: 120,
            child: Text(toDate, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B))),
          ),

          // 5. DAYS (Blue pill badge)
          SizedBox(
            width: 90,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('$days ${days == 1 ? "day" : "days"}', style: const TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ),
          ),

          // 6. REASON
          SizedBox(
            width: 180,
            child: Text(reason, style: const TextStyle(fontSize: 12, color: Color(0xFF475569)), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),

          // 7. STATUS BADGE
          SizedBox(
            width: 110,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _buildStatusBadge(status),
            ),
          ),

          // 8. REVIEW DETAILS
          SizedBox(
            width: 130,
            child: Text(reviewDetails, style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),

          // 9. ACTIONS (View button)
          SizedBox(
            width: 80,
            child: Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                onTap: () => _openLeaveDetails(l),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.visibility_outlined, size: 14, color: Color(0xFF475569)),
                      SizedBox(width: 4),
                      Text('View', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    if (status == 'approved') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFF86EFAC), width: 0.8),
        ),
        child: const Text('Approved', style: TextStyle(color: Color(0xFF16A34A), fontSize: 11, fontWeight: FontWeight.bold)),
      );
    } else if (status == 'rejected') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFFFCA5A5), width: 0.8),
        ),
        child: const Text('Rejected', style: TextStyle(color: Color(0xFFDC2626), fontSize: 11, fontWeight: FontWeight.bold)),
      );
    } else {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFFFDE68A), width: 0.8),
        ),
        child: const Text('Pending', style: TextStyle(color: Color(0xFFD97706), fontSize: 11, fontWeight: FontWeight.bold)),
      );
    }
  }
}
