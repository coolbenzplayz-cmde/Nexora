import 'package:flutter/material.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          _Section(title: 'Account', children: [
            _SettingTile(
              icon: Icons.person,
              title: 'Edit Profile',
              onTap: () {},
            ),
            _SettingTile(
              icon: Icons.lock,
              title: 'Change Password',
              onTap: () {},
            ),
            _SettingTile(
              icon: Icons.email,
              title: 'Email Settings',
              onTap: () {},
            ),
          ]),
          _Section(title: 'Privacy', children: [
            _SettingTile(
              icon: Icons.visibility,
              title: 'Privacy Settings',
              onTap: () {},
            ),
            _SettingTile(
              icon: Icons.block,
              title: 'Blocked Users',
              onTap: () {},
            ),
          ]),
          _Section(title: 'Notifications', children: [
            _SettingTile(
              icon: Icons.notifications,
              title: 'Push Notifications',
              trailing: Switch(value: true, onChanged: (v) {}),
            ),
            _SettingTile(
              icon: Icons.email,
              title: 'Email Notifications',
              trailing: Switch(value: true, onChanged: (v) {}),
            ),
          ]),
          _Section(title: 'Appearance', children: [
            _SettingTile(
              icon: Icons.dark_mode,
              title: 'Dark Mode',
              trailing: Switch(value: false, onChanged: (v) {}),
            ),
          ]),
          _Section(title: 'Support', children: [
            _SettingTile(
              icon: Icons.help,
              title: 'Help Center',
              onTap: () {},
            ),
            _SettingTile(
              icon: Icons.info,
              title: 'About',
              onTap: () {},
            ),
          ]),
          const SizedBox(height: 16),
          _Section(title: 'Danger Zone', children: [
            _SettingTile(
              icon: Icons.logout,
              title: 'Log Out',
              titleColor: Colors.red,
              onTap: () => _showLogoutDialog(context),
            ),
            _SettingTile(
              icon: Icons.delete,
              title: 'Delete Account',
              titleColor: Colors.red,
              onTap: () {},
            ),
          ]),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log Out'),
        content: const Text('Are you sure you want to log out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.go('/login');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
        ),
        ...children,
      ],
    );
  }
}

class _SettingTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? titleColor;

  const _SettingTile({
    required this.icon,
    required this.title,
    this.trailing,
    this.onTap,
    this.titleColor,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(
        title,
        style: TextStyle(color: titleColor),
      ),
      trailing: trailing ?? (onTap != null ? const Icon(Icons.chevron_right) : null),
      onTap: onTap,
    );
  }
}
