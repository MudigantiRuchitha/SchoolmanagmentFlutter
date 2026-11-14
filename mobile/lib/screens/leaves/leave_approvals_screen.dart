import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../models/leave_model.dart';
import '../../providers/leaves_provider.dart';

class LeaveApprovalsScreen extends StatefulWidget {
  const LeaveApprovalsScreen({super.key});

  @override
  State<LeaveApprovalsScreen> createState() => _LeaveApprovalsScreenState();
}

class _LeaveApprovalsScreenState extends State<LeaveApprovalsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LeavesProvider>().fetchLeaves();
    });
  }

  void _showActionDialog(BuildContext context, LeaveApplication leave, String action) {
    final isApprove = action == 'approved';
    final remarksController = TextEditingController(
      text: isApprove ? 'Approved' : 'Leave request rejected',
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(
              isApprove ? Icons.check_circle_rounded : Icons.cancel_rounded,
              color: isApprove ? AppTheme.success : AppTheme.danger,
              size: 24,
            ),
            const SizedBox(width: 8),
            Text(isApprove ? 'Approve Leave' : 'Reject Leave'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${isApprove ? "Approve" : "Reject"} leave application for ${leave.staffName} (${leave.totalDays} days)?',
              style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: remarksController,
              decoration: InputDecoration(
                labelText: 'Admin Remarks',
                hintText: isApprove ? 'e.g. Approved by Admin' : 'Reason for rejection',
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
            style: ElevatedButton.styleFrom(
              backgroundColor: isApprove ? AppTheme.success : AppTheme.danger,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              final leavesProv = context.read<LeavesProvider>();
              final success = await leavesProv.updateStatus(
                leaveId: leave.id,
                newStatus: action,
                remarks: remarksController.text.trim(),
              );

              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    success
                        ? 'Leave application ${isApprove ? "approved" : "rejected"} successfully.'
                        : (leavesProv.errorMessage ?? 'Failed to update leave status'),
                  ),
                  backgroundColor: success ? AppTheme.success : AppTheme.danger,
                ),
              );
            },
            child: Text(isApprove ? 'Approve' : 'Reject'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final leavesProv = context.watch<LeavesProvider>();
    final leaves = leavesProv.leaves;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => leavesProv.fetchLeaves(),
        color: AppTheme.primary,
        child: Column(
          children: [
            // Status Tabs
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: AppTheme.surface,
              child: Row(
                children: [
                  _statusTab('Pending', 'pending', leavesProv),
                  const SizedBox(width: 8),
                  _statusTab('Approved', 'approved', leavesProv),
                  const SizedBox(width: 8),
                  _statusTab('Rejected', 'rejected', leavesProv),
                  const SizedBox(width: 8),
                  _statusTab('All', '', leavesProv),
                ],
              ),
            ),

            // List of leaves
            Expanded(
              child: leavesProv.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : leaves.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.event_available_rounded, size: 52, color: AppTheme.textMuted),
                              const SizedBox(height: 12),
                              Text(
                                'No ${leavesProv.statusFilter.isEmpty ? "" : "${leavesProv.statusFilter} "}leave requests.',
                                style: const TextStyle(color: AppTheme.textSecondary),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(14),
                          itemCount: leaves.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (ctx, idx) {
                            final leave = leaves[idx];
                            final isPending = leave.status.toLowerCase() == 'pending';

                            return Card(
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        CircleAvatar(
                                          radius: 20,
                                          backgroundColor: AppTheme.primaryLight,
                                          child: Text(
                                            leave.staffName.isNotEmpty ? leave.staffName[0].toUpperCase() : 'S',
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                leave.staffName,
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                                              ),
                                              Text(
                                                leave.designation ?? 'Staff Member',
                                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                              ),
                                            ],
                                          ),
                                        ),
                                        _buildStatusBadge(leave.status),
                                      ],
                                    ),
                                    const Divider(height: 20),
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primaryLight,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            leave.leaveType,
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primary),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        const Icon(Icons.date_range_rounded, size: 14, color: AppTheme.textMuted),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${leave.startDate} → ${leave.endDate}',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                                        ),
                                        const Spacer(),
                                        Text(
                                          '${leave.totalDays} ${leave.totalDays == 1 ? "day" : "days"}',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Reason: ${leave.reason.isNotEmpty ? leave.reason : "No reason provided"}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                    ),
                                    if (leave.adminRemarks != null && leave.adminRemarks!.isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: AppTheme.surface,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: AppTheme.border),
                                        ),
                                        child: Text(
                                          'Remarks: ${leave.adminRemarks}',
                                          style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppTheme.textMuted),
                                        ),
                                      ),
                                    ],
                                    if (isPending) ...[
                                      const SizedBox(height: 12),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          OutlinedButton.icon(
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppTheme.danger,
                                              side: const BorderSide(color: AppTheme.danger),
                                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                            ),
                                            icon: const Icon(Icons.close_rounded, size: 16),
                                            label: const Text('Reject', style: TextStyle(fontSize: 12)),
                                            onPressed: () => _showActionDialog(context, leave, 'rejected'),
                                          ),
                                          const SizedBox(width: 8),
                                          ElevatedButton.icon(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppTheme.success,
                                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                            ),
                                            icon: const Icon(Icons.check_rounded, size: 16),
                                            label: const Text('Approve', style: TextStyle(fontSize: 12)),
                                            onPressed: () => _showActionDialog(context, leave, 'approved'),
                                          ),
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

  Widget _statusTab(String label, String value, LeavesProvider prov) {
    final isSelected = prov.statusFilter == value;
    return Expanded(
      child: InkWell(
        onTap: () => prov.setStatusFilter(value),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary : AppTheme.cardBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSelected ? AppTheme.primary : AppTheme.border),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : AppTheme.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    String label;

    switch (status.toLowerCase()) {
      case 'approved':
        bg = const Color(0xFFE8F5E9);
        fg = AppTheme.success;
        label = 'Approved';
        break;
      case 'rejected':
        bg = const Color(0xFFFFEBEE);
        fg = AppTheme.danger;
        label = 'Rejected';
        break;
      default:
        bg = const Color(0xFFFFF8E1);
        fg = AppTheme.warning;
        label = 'Pending';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}
