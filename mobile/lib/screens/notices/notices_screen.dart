import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../settings/settings_screen.dart';

class NoticesScreen extends StatefulWidget {
  const NoticesScreen({super.key});

  @override
  State<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends State<NoticesScreen> {
  final ApiService _api = ApiService(StorageService());

  List<dynamic> _notices = [];
  bool _isLoading = true;
  String _search = '';
  String _filterAudience = 'all'; // 'all', 'staff', 'students'
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchNotices();
  }

  Future<void> _fetchNotices() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final params = <String, dynamic>{};
      if (_filterAudience != 'all') {
        params['audience'] = _filterAudience;
      }
      final res = await _api.getNotices(params);
      if (mounted) {
        setState(() {
          _notices = res;
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

  List<dynamic> get _filteredNotices {
    return _notices.where((n) {
      final q = _search.toLowerCase().trim();
      final title = (n['title'] ?? '').toString().toLowerCase();
      final content = (n['content'] ?? '').toString().toLowerCase();

      final matchesSearch = q.isEmpty || title.contains(q) || content.contains(q);

      final audience = (n['target_type'] ?? n['audience'] ?? 'all').toString().toLowerCase();
      final matchesAudience = _filterAudience == 'all' || audience == _filterAudience || audience == 'all';

      return matchesSearch && matchesAudience;
    }).toList();
  }

  // =========================================================================
  // POST / EDIT NOTICE MODAL
  // =========================================================================
  void _showNoticeModal([Map<String, dynamic>? notice]) {
    final isEdit = notice != null;
    final titleCtrl = TextEditingController(text: notice?['title'] ?? '');
    final contentCtrl = TextEditingController(text: notice?['content'] ?? '');
    String audience = notice?['target_type'] ?? notice?['audience'] ?? 'all';
    bool isImportant = notice?['is_important'] == true || notice?['is_important'] == 1;

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
                          child: Icon(isEdit ? Icons.edit_note_rounded : Icons.campaign_rounded, color: const Color(0xFF4F46E5), size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            isEdit ? 'Edit Notice' : 'Post New Notice',
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

                    const Text('Notice Title *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: titleCtrl,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'e.g. Annual Sports Day Announcement',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Target Audience
                    const Text('Target Audience *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(border: Border.all(color: const Color(0xFFCBD5E1)), borderRadius: BorderRadius.circular(8)),
                      child: DropdownButtonHideUnderline(
                        child: Builder(builder: (context) {
                          const audienceItems = [
                            DropdownMenuItem(value: 'all', child: Text('All (Staff & Students)', style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(value: 'staff', child: Text('Staff Only', style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(value: 'students', child: Text('Students Only', style: TextStyle(fontSize: 13))),
                          ];
                          final safeAudience = audienceItems.any((i) => i.value == audience) ? audience : 'all';

                          return DropdownButton<String>(
                            value: safeAudience,
                            isExpanded: true,
                            items: audienceItems,
                            onChanged: (v) {
                              if (v != null) setDlgState(() => audience = v);
                            },
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Content
                    const Text('Notice Content *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: contentCtrl,
                      maxLines: 4,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Write the details of the circular or announcement...',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Important switch
                    Row(
                      children: [
                        Checkbox(
                          value: isImportant,
                          activeColor: const Color(0xFF4F46E5),
                          onChanged: (v) => setDlgState(() => isImportant = v ?? false),
                        ),
                        const Text('Mark as High Priority / Important', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500)),
                      ],
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
                                  if (titleCtrl.text.trim().isEmpty || contentCtrl.text.trim().isEmpty) {
                                    setDlgState(() => dialogError = 'Title and content are required.');
                                    return;
                                  }

                                  setDlgState(() {
                                    isSaving = true;
                                    dialogError = null;
                                  });

                                  try {
                                    if (isEdit) {
                                      await _api.updateNotice(notice['id'], {
                                        'title': titleCtrl.text.trim(),
                                        'content': contentCtrl.text.trim(),
                                        'target_type': audience,
                                        'is_important': isImportant,
                                      });
                                    } else {
                                      await _api.createNotice(
                                        title: titleCtrl.text.trim(),
                                        content: contentCtrl.text.trim(),
                                        targetType: audience,
                                        isImportant: isImportant,
                                      );
                                    }

                                    if (mounted) {
                                      Navigator.pop(ctx);
                                      _fetchNotices();
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(isEdit ? 'Notice updated successfully!' : 'Notice posted successfully!'),
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
                          child: Text(isSaving ? 'Saving...' : (isEdit ? 'Update Notice' : 'Post Notice')),
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

    final filtered = _filteredNotices;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const CustomAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. PAGE TITLE & SUBTITLE
            const PageHeaderTitle(
              title: 'Notices',
              subtitle: 'Post and manage announcements for staff and students',
            ),

            // 2. TOOLBAR (Search, Audience Pills, Count, + Post Notice)
            _buildToolbar(filtered.length),
            const SizedBox(height: 24),

            // 3. NOTICES CONTENT (List or Empty State matching screenshot)
            _buildNoticesContent(filtered),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // TOOLBAR (SEARCH, ALL/STAFF/STUDENTS PILLS, COUNT, POST NOTICE)
  // =========================================================================
  Widget _buildToolbar(int count) {
    return Wrap(
      spacing: 14,
      runSpacing: 10,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Left: Search + Audience Filter Pills + Counter
        Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            // Search Input
            Container(
              width: 240,
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
                  hintText: 'Search announcements...',
                  hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  prefixIcon: Icon(Icons.search_rounded, size: 16, color: Color(0xFF94A3B8)),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                ),
                onChanged: (v) => setState(() => _search = v),
              ),
            ),

            // Audience Filter Pills (All, Staff, Students)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              padding: const EdgeInsets.all(3),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildAudiencePill('All', 'all'),
                  _buildAudiencePill('Staff', 'staff'),
                  _buildAudiencePill('Students', 'students'),
                ],
              ),
            ),

            // Counter
            Text(
              '$count notices',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),

        // Right: + Post Notice
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF4F46E5),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
          ),
          onPressed: () => _showNoticeModal(),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Post Notice', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildAudiencePill(String label, String value) {
    final isSelected = _filterAudience == value;
    return InkWell(
      onTap: () {
        setState(() => _filterAudience = value);
        _fetchNotices();
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  // =========================================================================
  // NOTICES CONTENT (EMPTY STATE MATCHING SCREENSHOT OR LIST)
  // =========================================================================
  Widget _buildNoticesContent(List<dynamic> list) {
    if (_isLoading) {
      return Container(
        height: 300,
        alignment: Alignment.center,
        child: const CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5)),
      );
    }

    if (_errorMessage != null) {
      return Container(
        height: 200,
        alignment: Alignment.center,
        child: Text('Error: $_errorMessage', style: const TextStyle(color: Color(0xFFDC2626))),
      );
    }

    // EMPTY STATE MATCHING SCREENSHOT EXACTLY
    if (list.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 80, horizontal: 20),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFF64748B),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.chat_bubble_rounded, color: Colors.white, size: 28),
            ),
            const SizedBox(height: 16),
            const Text(
              'No notices found',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Post an announcement for your staff and students',
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
      );
    }

    // LIST OF NOTICES
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: list.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (ctx, idx) {
        final n = list[idx];
        final title = (n['title'] ?? 'Notice').toString();
        final content = (n['content'] ?? '').toString();
        final audience = (n['target_type'] ?? n['audience'] ?? 'all').toString().toLowerCase();
        final isImportant = n['is_important'] == true || n['is_important'] == 1;

        String dateStr = '—';
        if (n['created_at'] != null) {
          try {
            dateStr = DateFormat('d MMM yyyy, h:mm a').format(DateTime.parse(n['created_at'].toString()));
          } catch (_) {
            dateStr = n['created_at'].toString();
          }
        }

        return Container(
          padding: const EdgeInsets.all(18),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (isImportant) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                margin: const EdgeInsets.only(right: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEE2E2),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'IMPORTANT',
                                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                                ),
                              ),
                            ],
                            _buildAudienceBadge(audience),
                            const SizedBox(width: 8),
                            Text(dateStr, style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8))),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          title,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF64748B)),
                        onPressed: () => _showNoticeModal(Map<String, dynamic>.from(n)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFEF4444)),
                        onPressed: () async {
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (c) => AlertDialog(
                              title: const Text('Delete Notice?'),
                              content: Text('Delete notice "$title"?'),
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
                              await _api.deleteNotice(n['id']);
                              _fetchNotices();
                            } catch (_) {}
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                content,
                style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAudienceBadge(String audience) {
    if (audience == 'staff') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(4)),
        child: const Text('Staff', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
      );
    } else if (audience == 'students') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(4)),
        child: const Text('Students', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
      );
    } else {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(4)),
        child: const Text('All', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
      );
    }
  }
}
