import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../screens/notices/notices_screen.dart';
import '../screens/settings/settings_screen.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final bool showBackButton;
  final VoidCallback? onBack;

  const CustomAppBar({
    super.key,
    this.showBackButton = true,
    this.onBack,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final org = auth.org;
    final canPop = Navigator.canPop(context);

    return AppBar(
      elevation: 0.5,
      backgroundColor: Colors.white,
      foregroundColor: AppTheme.textPrimary,
      leading: (showBackButton && canPop)
          ? IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
              onPressed: onBack ?? () => Navigator.pop(context),
            )
          : null,
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.school_rounded, color: AppTheme.primary, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  org?.name ?? 'School Management',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${user?.name ?? "Admin"} • ${(user?.role ?? "Admin").toUpperCase()}',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.campaign_outlined, color: AppTheme.textPrimary),
          tooltip: 'Notices',
          onPressed: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const NoticesScreen()));
          },
        ),
        IconButton(
          icon: const Icon(Icons.settings_outlined, color: AppTheme.textPrimary),
          tooltip: 'Settings',
          onPressed: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
          },
        ),
      ],
    );
  }
}

