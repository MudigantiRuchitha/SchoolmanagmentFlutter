import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../models/staff_model.dart';
import '../../providers/staff_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<StaffProvider>().fetchStaff();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showStaffDetailsSheet(BuildContext context, StaffMember member) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppTheme.primaryLight,
                  child: Text(
                    member.fullName.isNotEmpty ? member.fullName[0].toUpperCase() : 'S',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.primary),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        member.fullName,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        member.designation ?? member.roleType.toUpperCase(),
                        style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                _buildRoleBadge(member.roleType),
              ],
            ),
            const Divider(height: 28),
            _buildInfoTile(Icons.badge_outlined, 'Staff ID', member.staffId ?? '#${member.id}', ctx),
            _buildInfoTile(Icons.schedule_rounded, 'Working Hours', '${member.expectedCheckIn} – ${member.expectedCheckOut}', ctx),
            _buildInfoTile(Icons.business_outlined, 'Campus / Branch', member.branchName ?? 'Main Branch', ctx),
            if (member.phone != null && member.phone!.isNotEmpty)
              _buildInfoTile(Icons.phone_outlined, 'Phone', member.phone!, ctx, isCopyable: true),
            if (member.email != null && member.email!.isNotEmpty)
              _buildInfoTile(Icons.email_outlined, 'Email', member.email!, ctx, isCopyable: true),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String label, String value, BuildContext ctx, {bool isCopyable = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppTheme.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
              ],
            ),
          ),
          if (isCopyable)
            IconButton(
              icon: const Icon(Icons.copy_rounded, size: 18, color: AppTheme.primary),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(ctx).showSnackBar(
                  SnackBar(content: Text('$label copied to clipboard'), duration: const Duration(seconds: 1)),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildRoleBadge(String roleType) {
    Color bg;
    Color fg;
    String label;

    switch (roleType.toLowerCase()) {
      case 'management':
        bg = const Color(0xFFEDE7F6);
        fg = const Color(0xFF673AB7);
        label = 'Management';
        break;
      case 'non-teaching':
      case 'non_teaching':
        bg = const Color(0xFFFFF8E1);
        fg = const Color(0xFFF57C00);
        label = 'Non-Teaching';
        break;
      default:
        bg = const Color(0xFFE8F5E9);
        fg = const Color(0xFF2E7D32);
        label = 'Teaching';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final staffProv = context.watch<StaffProvider>();
    final staffList = staffProv.staff;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: Navigator.canPop(context) ? const CustomAppBar() : null,
      body: RefreshIndicator(
        onRefresh: () => staffProv.fetchStaff(),
        color: AppTheme.primary,
        child: Column(
          children: [
            Container(
              color: Colors.white,
              padding: const EdgeInsets.only(left: 16, right: 16, top: 14),
              child: const PageHeaderTitle(
                title: 'Staff Directory',
                subtitle: 'Manage teaching, non-teaching, and administrative staff members',
              ),
            ),
            // Search & Category Filters
            Container(
              padding: const EdgeInsets.all(14),
              color: AppTheme.surface,
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search staff by name, designation, ID...',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                staffProv.setSearch('');
                              },
                            )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onChanged: (v) => staffProv.setSearch(v),
                  ),
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _filterChip(label: 'All Roles', selected: staffProv.selectedRoleType == null, onTap: () => staffProv.setRoleType(null)),
                        const SizedBox(width: 8),
                        _filterChip(label: 'Teaching', selected: staffProv.selectedRoleType == 'teaching', onTap: () => staffProv.setRoleType('teaching')),
                        const SizedBox(width: 8),
                        _filterChip(label: 'Non-Teaching', selected: staffProv.selectedRoleType == 'non-teaching', onTap: () => staffProv.setRoleType('non-teaching')),
                        const SizedBox(width: 8),
                        _filterChip(label: 'Management', selected: staffProv.selectedRoleType == 'management', onTap: () => staffProv.setRoleType('management')),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Header Count
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Text(
                    '${staffList.length} Staff Members Found',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),

            // Staff List
            Expanded(
              child: staffProv.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : staffList.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.badge_outlined, size: 48, color: AppTheme.textMuted),
                              SizedBox(height: 12),
                              Text('No staff members found.', style: TextStyle(color: AppTheme.textSecondary)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.only(left: 14, right: 14, bottom: 80),
                          itemCount: staffList.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, idx) {
                            final member = staffList[idx];
                            return Card(
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                leading: CircleAvatar(
                                  radius: 22,
                                  backgroundColor: AppTheme.primaryLight,
                                  child: Text(
                                    member.fullName.isNotEmpty ? member.fullName[0].toUpperCase() : 'S',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary, fontSize: 16),
                                  ),
                                ),
                                title: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        member.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    _buildRoleBadge(member.roleType),
                                  ],
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Text(
                                      '${member.designation ?? "Staff"} • ID: ${member.staffId ?? "#${member.id}"}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.schedule_rounded, size: 13, color: AppTheme.textMuted),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${member.expectedCheckIn} – ${member.expectedCheckOut}',
                                          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                        ),
                                        if (member.branchName != null) ...[
                                          const SizedBox(width: 8),
                                          const Text('•', style: TextStyle(color: AppTheme.textMuted)),
                                          const SizedBox(width: 8),
                                          Text(
                                            member.branchName!,
                                            style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                                trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
                                onTap: () => _showStaffDetailsSheet(context, member),
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

  Widget _filterChip({required String label, required bool selected, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppTheme.primary : AppTheme.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? AppTheme.primary : AppTheme.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.bold : FontWeight.w500,
            color: selected ? Colors.white : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }
}
