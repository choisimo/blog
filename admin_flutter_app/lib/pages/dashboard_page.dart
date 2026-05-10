import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/auth_store.dart';
import 'admin_ops_page.dart';
import 'ai_page.dart';
import 'analytics_page.dart';
import 'config_page.dart';
import 'content_page.dart';
import 'health_page.dart';
import 'logs_page.dart';
import 'new_post_page.dart';
import 'rag_page.dart';
import 'secrets_page.dart';
import 'workers_page.dart';

enum AdminTab {
  health('Health', Icons.monitor_heart),
  rag('RAG', Icons.storage),
  analytics('Analytics', Icons.bar_chart),
  logs('Logs', Icons.receipt_long),
  content('Content', Icons.article),
  ai('AI', Icons.psychology),
  config('Env', Icons.tune),
  secrets('Secrets', Icons.key),
  workers('Workers', Icons.cloud),
  newPost('New Post', Icons.post_add),
  ops('Admin Ops', Icons.settings_suggest);

  const AdminTab(this.label, this.icon);
  final String label;
  final IconData icon;
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.auth, required this.api});

  final AuthStore auth;
  final AdminApiClient api;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  AdminTab _tab = AdminTab.health;

  @override
  Widget build(BuildContext context) {
    final body = switch (_tab) {
      AdminTab.health => HealthPage(api: widget.api),
      AdminTab.rag => RagPage(api: widget.api),
      AdminTab.analytics => AnalyticsPage(api: widget.api),
      AdminTab.logs => LogsPage(api: widget.api),
      AdminTab.content => ContentPage(api: widget.api),
      AdminTab.ai => AiPage(api: widget.api),
      AdminTab.config => ConfigPage(api: widget.api),
      AdminTab.secrets => SecretsPage(api: widget.api),
      AdminTab.workers => WorkersPage(api: widget.api),
      AdminTab.newPost => NewPostPage(api: widget.api, auth: widget.auth),
      AdminTab.ops => AdminOpsPage(api: widget.api),
    };

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 960;
        return Scaffold(
          appBar: AppBar(
            title: Row(
              children: [
                const Icon(Icons.admin_panel_settings),
                const SizedBox(width: 8),
                Text('noblog admin · ${_tab.label}'),
              ],
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Center(
                    child: Text(widget.auth.userLabel,
                        style: const TextStyle(
                            fontFamily: 'monospace', fontSize: 12))),
              ),
              IconButton(
                tooltip: 'Logout',
                onPressed: () => widget.auth.logout(),
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          drawer: wide
              ? null
              : Drawer(
                  child: _NavigationList(
                      current: _tab,
                      onChanged: (tab) => setState(() => _tab = tab))),
          body: Row(
            children: [
              if (wide)
                NavigationRail(
                  selectedIndex: AdminTab.values.indexOf(_tab),
                  onDestinationSelected: (index) =>
                      setState(() => _tab = AdminTab.values[index]),
                  labelType: NavigationRailLabelType.all,
                  minWidth: 92,
                  destinations: [
                    for (final tab in AdminTab.values)
                      NavigationRailDestination(
                          icon: Icon(tab.icon), label: Text(tab.label)),
                  ],
                ),
              if (wide) const VerticalDivider(width: 1),
              Expanded(child: body),
            ],
          ),
        );
      },
    );
  }
}

class _NavigationList extends StatelessWidget {
  const _NavigationList({required this.current, required this.onChanged});

  final AdminTab current;
  final ValueChanged<AdminTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        children: [
          const ListTile(
              title: Text('Admin navigation'), leading: Icon(Icons.menu)),
          for (final tab in AdminTab.values)
            ListTile(
              leading: Icon(tab.icon),
              title: Text(tab.label),
              selected: current == tab,
              onTap: () {
                Navigator.of(context).pop();
                onChanged(tab);
              },
            ),
        ],
      ),
    );
  }
}
