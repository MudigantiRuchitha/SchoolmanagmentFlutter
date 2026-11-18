import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/page_header_title.dart';
import '../auth/login_screen.dart';
import '../notices/notices_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiService _api = ApiService(StorageService());
  Map<String, dynamic>? _settings;
  bool _isLoading = true;
  bool _isSaving = false;

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _domainController = TextEditingController();
  final _addressController = TextEditingController();

  // Developer Server URL
  final _serverUrlController = TextEditingController();
  bool _testingConnection = false;
  String? _connectionStatus;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _serverUrlController.text = auth.baseUrl;
    _loadSettings();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _domainController.dispose();
    _addressController.dispose();
    _serverUrlController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() => _isLoading = true);
    try {
      final s = await _api.getSettings();
      if (mounted) {
        setState(() {
          _settings = s;
          _nameController.text = s['name'] ?? '';
          _phoneController.text = s['phone'] ?? '';
          _emailController.text = s['email'] ?? '';
          _domainController.text = s['domain'] ?? '';
          _addressController.text = s['address'] ?? '';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _saveSettings() async {
    setState(() => _isSaving = true);
    try {
      await _api.updateSettings({
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'email': _emailController.text.trim(),
        'domain': _domainController.text.trim(),
        'address': _addressController.text.trim(),
      });
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Settings saved successfully!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save settings: $e'), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    }
  }

  // =========================================================================
  // CHANGE PASSWORD MODAL
  // =========================================================================
  void _showChangePasswordModal() {
    final currentPassCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    final confirmPassCtrl = TextEditingController();
    String? modalError;
    bool isChanging = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: Colors.white,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.lock_outline_rounded, color: Color(0xFF4F46E5), size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Change Password',
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

                  if (modalError != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Text(modalError!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
                    ),

                  _buildInput('Current Password', currentPassCtrl, '••••••••', isPassword: true),
                  const SizedBox(height: 12),
                  _buildInput('New Password', newPassCtrl, 'At least 6 characters', isPassword: true),
                  const SizedBox(height: 12),
                  _buildInput('Confirm New Password', confirmPassCtrl, 'Confirm new password', isPassword: true),
                  const SizedBox(height: 20),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4F46E5),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: isChanging
                            ? null
                            : () async {
                                if (currentPassCtrl.text.isEmpty || newPassCtrl.text.isEmpty) {
                                  setDlgState(() => modalError = 'Please fill all password fields.');
                                  return;
                                }
                                if (newPassCtrl.text.length < 6) {
                                  setDlgState(() => modalError = 'New password must be at least 6 characters.');
                                  return;
                                }
                                if (newPassCtrl.text != confirmPassCtrl.text) {
                                  setDlgState(() => modalError = 'Passwords do not match.');
                                  return;
                                }

                                setDlgState(() {
                                  isChanging = true;
                                  modalError = null;
                                });

                                try {
                                  await _api.changePassword({
                                    'currentPassword': currentPassCtrl.text,
                                    'newPassword': newPassCtrl.text,
                                  });
                                  if (mounted) {
                                    Navigator.pop(ctx);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Password changed successfully!'),
                                        backgroundColor: Color(0xFF10B981),
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  setDlgState(() {
                                    isChanging = false;
                                    modalError = e.toString();
                                  });
                                }
                              },
                        child: Text(isChanging ? 'Updating...' : 'Change Password'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _testConnection() async {
    setState(() {
      _testingConnection = true;
      _connectionStatus = null;
    });

    final auth = context.read<AuthProvider>();
    await auth.updateBaseUrl(_serverUrlController.text.trim());

    try {
      final success = await auth.checkAuth();
      if (mounted) {
        setState(() {
          _testingConnection = false;
          _connectionStatus = success ? 'Connected successfully! Server is online.' : 'Server reached, please ensure you are logged in.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _testingConnection = false;
          _connectionStatus = 'Failed to connect: $e';
        });
      }
    }
  }

  // =========================================================================
  // MAIN BUILD METHOD
  // =========================================================================
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final orgCode = _settings?['code'] ?? auth.org?.code ?? 'ACS1';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const CustomAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 900;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. PAGE TITLE & SUBTITLE
                const PageHeaderTitle(
                  title: 'Settings',
                  subtitle: 'Manage organisation settings',
                ),

                if (_isLoading)
                  Container(
                    height: 300,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Center(
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF4F46E5)),
                    ),
                  )
                else if (isWide)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Left: Organisation Profile Card
                      Expanded(child: _buildOrgProfileCard(orgCode)),
                      const SizedBox(width: 24),

                      // Right: Security & Login Info Cards
                      SizedBox(
                        width: 320,
                        child: Column(
                          children: [
                            _buildSecurityCard(),
                            const SizedBox(height: 20),
                            _buildLoginInfoCard(orgCode),
                            const SizedBox(height: 20),
                            _buildServerSettingsCard(),
                          ],
                        ),
                      ),
                    ],
                  )
                else
                  Column(
                    children: [
                      _buildOrgProfileCard(orgCode),
                      const SizedBox(height: 20),
                      _buildSecurityCard(),
                      const SizedBox(height: 20),
                      _buildLoginInfoCard(orgCode),
                      const SizedBox(height: 20),
                      _buildServerSettingsCard(),
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
  // ORGANISATION PROFILE CARD
  // =========================================================================
  Widget _buildOrgProfileCard(String orgCode) {
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
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              children: [
                const Icon(Icons.business_rounded, size: 20, color: Color(0xFF1E293B)),
                const SizedBox(width: 8),
                const Text(
                  'Organisation Profile',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Body Form
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Organisation Code Box
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Organisation Code', style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                      const SizedBox(height: 4),
                      Text(
                        orgCode.toUpperCase(),
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5)),
                      ),
                      const SizedBox(height: 4),
                      const Row(
                        children: [
                          Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFF64748B)),
                          SizedBox(width: 4),
                          Text('Code cannot be changed. Share this with your org admins.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                _buildInput('Organisation Name', _nameController, 'e.g. Acme International School'),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(child: _buildInput('Phone', _phoneController, '9874563210', isPhone: true)),
                    const SizedBox(width: 14),
                    Expanded(child: _buildInput('Email', _emailController, 'school@edu.in', isEmail: true)),
                  ],
                ),
                const SizedBox(height: 14),

                _buildInput('Domain', _domainController, 'e.g. school.edu.in'),
                const SizedBox(height: 14),

                _buildInput('Address', _addressController, 'Full campus address...', maxLines: 3),
                const SizedBox(height: 20),

                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4F46E5),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                  onPressed: _isSaving ? null : _saveSettings,
                  icon: const Icon(Icons.save_rounded, size: 16),
                  label: Text(_isSaving ? 'Saving...' : 'Save Changes', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // SECURITY CARD
  // =========================================================================
  Widget _buildSecurityCard() {
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
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              children: [
                Icon(Icons.lock_outline_rounded, size: 18, color: Color(0xFF1E293B)),
                SizedBox(width: 8),
                Text('Security', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Keep your admin account secure by updating your password regularly.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B), height: 1.4),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF1E293B),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onPressed: _showChangePasswordModal,
                  icon: const Icon(Icons.lock_rounded, size: 15),
                  label: const Text('Change Password', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // LOGIN INFO CARD
  // =========================================================================
  Widget _buildLoginInfoCard(String orgCode) {
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
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              children: [
                Icon(Icons.login_rounded, size: 18, color: Color(0xFF1E293B)),
                SizedBox(width: 8),
                Text('Login Info', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildInfoSubBox('Login URL', 'http://localhost:2100/login'),
                const SizedBox(height: 10),
                _buildInfoSubBox('Org Code', orgCode.toLowerCase(), isMono: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoSubBox(String label, String value, {bool isMono = false}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              fontFamily: isMono ? 'monospace' : null,
              color: const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // SERVER SETTINGS / DEVELOPER UTILITY CARD
  // =========================================================================
  Widget _buildServerSettingsCard() {
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
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              children: [
                Icon(Icons.dns_rounded, size: 18, color: Color(0xFF64748B)),
                SizedBox(width: 8),
                Text('Server Connection', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _serverUrlController,
                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    isDense: true,
                    labelText: 'Backend API URL',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  onPressed: _testingConnection ? null : _testConnection,
                  child: Text(_testingConnection ? 'Testing...' : 'Test Connection', style: const TextStyle(fontSize: 12)),
                ),
                if (_connectionStatus != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _connectionStatus!,
                    style: TextStyle(
                      fontSize: 11,
                      color: _connectionStatus!.contains('successfully') ? const Color(0xFF10B981) : const Color(0xFFDC2626),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFFCA5A5)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onPressed: () async {
                    final auth = context.read<AuthProvider>();
                    await auth.logout();
                    if (!mounted) return;
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (route) => false,
                    );
                  },
                  icon: const Icon(Icons.logout_rounded, size: 16),
                  label: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInput(String label, TextEditingController ctrl, String hint, {bool isPhone = false, bool isEmail = false, bool isPassword = false, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: isPassword,
          maxLines: maxLines,
          keyboardType: isPhone ? TextInputType.phone : (isEmail ? TextInputType.emailAddress : TextInputType.text),
          style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF4F46E5), width: 1.5)),
          ),
        ),
      ],
    );
  }
}
