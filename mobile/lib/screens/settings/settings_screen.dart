import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../config/api_constants.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _serverUrlController = TextEditingController();
  bool _testingConnection = false;
  String? _connectionStatus;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _serverUrlController.text = auth.baseUrl;
  }

  @override
  void dispose() {
    _serverUrlController.dispose();
    super.dispose();
  }

  void _testConnection() async {
    setState(() {
      _testingConnection = true;
      _connectionStatus = null;
    });

    final auth = context.read<AuthProvider>();
    await auth.updateBaseUrl(_serverUrlController.text.trim());

    // Simple test via getMe or dashboard
    try {
      final success = await auth.checkAuth();
      setState(() {
        _testingConnection = false;
        _connectionStatus = success
            ? 'Connected successfully! Server is online.'
            : 'Server reached, please ensure you are logged in.';
      });
    } catch (e) {
      setState(() {
        _testingConnection = false;
        _connectionStatus = 'Connection error: $e';
      });
    }
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log Out'),
        content: const Text(
          'Are you sure you want to end your current session?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await context.read<AuthProvider>().logout();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final org = auth.org;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings & Configuration')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User & Role summary
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppTheme.primaryLight,
                    child: Text(
                      user?.name.isNotEmpty == true
                          ? user!.name[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? 'Admin User',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Role: ${(user?.role ?? "Admin").toUpperCase()}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          user?.email ?? user?.username ?? '',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Organization Info
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.school_rounded,
                        color: AppTheme.primary,
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Organization Details',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _buildRow(
                    'Institution Name',
                    org?.name ?? 'ACS School Portal',
                  ),
                  const SizedBox(height: 8),
                  _buildRow(
                    'Organization Code',
                    (org?.code ?? 'vts').toUpperCase(),
                  ),
                  const SizedBox(height: 8),
                  _buildRow(
                    'Attendance Mode',
                    org?.allowedAttendanceMode ?? 'BOTH (Manual & Face)',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Backend API Server Connection
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.dns_rounded,
                        color: AppTheme.primary,
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Backend API Server',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Ensure this URL points to your running Node.js backend. Emulator uses 10.0.2.2; Real devices use LAN WiFi IP.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _serverUrlController,
                    decoration: const InputDecoration(
                      labelText: 'API Base URL',
                      hintText: ApiConstants.defaultBaseUrl,
                      prefixIcon: Icon(Icons.link_rounded),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ActionChip(
                        avatar: const Icon(Icons.wifi_rounded, size: 16),
                        label: Text(
                          'Wi-Fi (${Uri.parse(ApiConstants.defaultBaseUrl).host})',
                        ),
                        onPressed: () {
                          _serverUrlController.text =
                              ApiConstants.defaultBaseUrl;
                        },
                      ),
                      ActionChip(
                        avatar: const Icon(
                          Icons.laptop_chromebook_rounded,
                          size: 16,
                        ),
                        label: const Text('Localhost (5000)'),
                        onPressed: () {
                          _serverUrlController.text =
                              'http://localhost:5000/api';
                        },
                      ),
                      ActionChip(
                        avatar: const Icon(
                          Icons.phone_android_rounded,
                          size: 16,
                        ),
                        label: const Text('Emulator (10.0.2.2)'),
                        onPressed: () {
                          _serverUrlController.text =
                              'http://10.0.2.2:5000/api';
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      ElevatedButton.icon(
                        icon: _testingConnection
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Save & Test Connection'),
                        onPressed: _testingConnection ? null : _testConnection,
                      ),
                    ],
                  ),
                  if (_connectionStatus != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: _connectionStatus!.contains('successfully')
                            ? const Color(0xFFE8F5E9)
                            : const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _connectionStatus!,
                        style: TextStyle(
                          fontSize: 12,
                          color: _connectionStatus!.contains('successfully')
                              ? AppTheme.success
                              : AppTheme.danger,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // App Info
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        color: AppTheme.primary,
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'About Application',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _buildRow('Application Name', 'ACS School Management Mobile'),
                  const SizedBox(height: 8),
                  _buildRow('Client Version', '1.0.0+1 (Release)'),
                  const SizedBox(height: 8),
                  _buildRow(
                    'Architecture',
                    'Native Flutter UI (Zero backend changes)',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Logout Button
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.danger,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: const Icon(Icons.logout_rounded),
            label: const Text(
              'Log Out of Account',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            onPressed: _handleLogout,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
      ],
    );
  }
}
