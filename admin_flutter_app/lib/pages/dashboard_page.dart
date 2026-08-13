import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/auth_store.dart';
import '../theme/admin_theme.dart';
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
  health,
  rag,
  analytics,
  logs,
  content,
  ai,
  config,
  secrets,
  workers,
  newPost,
  ops,
}

enum InactiveDestinationPolicy {
  pauseAnimations,
  keepAliveBounded,
}

typedef AdminPageBuilder = Widget Function(
  AuthStore auth,
  AdminApiClient api,
);

@immutable
class AdminDestination {
  const AdminDestination({
    required this.id,
    required this.pathSegment,
    required this.label,
    required this.icon,
    required this.pageBuilder,
    this.inactivePolicy = InactiveDestinationPolicy.pauseAnimations,
  });

  final AdminTab id;
  final String pathSegment;
  final String label;
  final IconData icon;
  final AdminPageBuilder pageBuilder;
  final InactiveDestinationPolicy inactivePolicy;
}

final List<AdminDestination> adminDestinations = List.unmodifiable([
  AdminDestination(
    id: AdminTab.health,
    pathSegment: 'health',
    label: 'Health',
    icon: Icons.monitor_heart_outlined,
    pageBuilder: (_, api) => HealthPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.rag,
    pathSegment: 'rag',
    label: 'RAG',
    icon: Icons.storage_outlined,
    pageBuilder: (_, api) => RagPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.analytics,
    pathSegment: 'analytics',
    label: 'Analytics',
    icon: Icons.bar_chart_outlined,
    pageBuilder: (_, api) => AnalyticsPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.logs,
    pathSegment: 'logs',
    label: 'Logs',
    icon: Icons.receipt_long_outlined,
    pageBuilder: (_, api) => LogsPage(api: api),
    inactivePolicy: InactiveDestinationPolicy.keepAliveBounded,
  ),
  AdminDestination(
    id: AdminTab.content,
    pathSegment: 'content',
    label: 'Content',
    icon: Icons.article_outlined,
    pageBuilder: (_, api) => ContentPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.ai,
    pathSegment: 'ai',
    label: 'AI',
    icon: Icons.psychology_outlined,
    pageBuilder: (_, api) => AiPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.config,
    pathSegment: 'environment',
    label: 'Environment',
    icon: Icons.tune_outlined,
    pageBuilder: (_, api) => ConfigPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.secrets,
    pathSegment: 'secrets',
    label: 'Secrets',
    icon: Icons.key_outlined,
    pageBuilder: (_, api) => SecretsPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.workers,
    pathSegment: 'workers',
    label: 'Workers',
    icon: Icons.cloud_outlined,
    pageBuilder: (_, api) => WorkersPage(api: api),
  ),
  AdminDestination(
    id: AdminTab.newPost,
    pathSegment: 'new-post',
    label: 'New Post',
    icon: Icons.post_add_outlined,
    pageBuilder: (auth, api) => NewPostPage(api: api, auth: auth),
  ),
  AdminDestination(
    id: AdminTab.ops,
    pathSegment: 'operations',
    label: 'Admin Ops',
    icon: Icons.settings_suggest_outlined,
    pageBuilder: (_, api) => AdminOpsPage(api: api),
  ),
]);

class DashboardPage extends StatefulWidget {
  const DashboardPage({
    super.key,
    required this.auth,
    required this.api,
    this.destinations = const [],
  });

  final AuthStore auth;
  final AdminApiClient api;
  final List<AdminDestination> destinations;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late AdminTab _tab;
  final List<AdminTab> _visited = [];
  final Map<AdminTab, Widget> _pages = {};

  List<AdminDestination> get _destinations =>
      widget.destinations.isEmpty ? adminDestinations : widget.destinations;

  @override
  void initState() {
    super.initState();
    assert(_destinations.isNotEmpty);
    _tab = _destinations.first.id;
    _visit(_tab);
  }

  @override
  void didUpdateWidget(covariant DashboardPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.auth == widget.auth && oldWidget.api == widget.api) return;
    for (final tab in _visited) {
      _pages[tab] = _buildPage(tab);
    }
  }

  AdminDestination _destinationFor(AdminTab tab) {
    return _destinations.firstWhere((destination) => destination.id == tab);
  }

  Widget _buildPage(AdminTab tab) {
    final destination = _destinationFor(tab);
    return KeyedSubtree(
      key: PageStorageKey<String>('admin:${destination.pathSegment}'),
      child: destination.pageBuilder(widget.auth, widget.api),
    );
  }

  void _visit(AdminTab tab) {
    if (!_visited.contains(tab)) _visited.add(tab);
    _pages.putIfAbsent(tab, () => _buildPage(tab));
  }

  void _select(AdminTab tab) {
    if (_tab == tab) return;
    setState(() {
      _visit(tab);
      _tab = tab;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    final current = _destinationFor(_tab);

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= tokens.desktopBreakpoint;
        final showIdentity = constraints.maxWidth >= 760;
        return Scaffold(
          appBar: AppBar(
            titleSpacing: wide ? tokens.spaceMd : 0,
            title: Row(
              children: [
                const Icon(Icons.admin_panel_settings_outlined),
                SizedBox(width: tokens.spaceSm),
                Flexible(
                  child: Text(
                    'noblog admin · ${current.label}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            actions: [
              if (showIdentity)
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: tokens.spaceSm),
                  child: Center(
                    child: Text(
                      widget.auth.userLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontFamily: 'monospace',
                          ),
                    ),
                  ),
                ),
              IconButton(
                tooltip: 'Log out',
                onPressed: widget.auth.logout,
                icon: const Icon(Icons.logout),
              ),
              SizedBox(width: tokens.spaceXs),
            ],
          ),
          drawer: wide
              ? null
              : _AdminDrawer(
                  current: _tab,
                  destinations: _destinations,
                  userLabel: widget.auth.userLabel,
                  onChanged: _select,
                  onLogout: widget.auth.logout,
                ),
          body: Row(
            children: [
              if (wide)
                NavigationRail(
                  selectedIndex: _destinations
                      .indexWhere((destination) => destination.id == _tab),
                  onDestinationSelected: (index) =>
                      _select(_destinations[index].id),
                  groupAlignment: -1,
                  scrollable: true,
                  destinations: [
                    for (final destination in _destinations)
                      NavigationRailDestination(
                        icon: Icon(destination.icon),
                        selectedIcon: Icon(
                          destination.icon,
                          fill: 1,
                        ),
                        label: Text(destination.label),
                      ),
                  ],
                ),
              if (wide) const VerticalDivider(),
              Expanded(
                key: const ValueKey('admin-destination-host'),
                child: _LazyDestinationHost(
                  current: _tab,
                  visited: _visited,
                  pages: _pages,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _LazyDestinationHost extends StatelessWidget {
  const _LazyDestinationHost({
    required this.current,
    required this.visited,
    required this.pages,
  });

  final AdminTab current;
  final List<AdminTab> visited;
  final Map<AdminTab, Widget> pages;

  @override
  Widget build(BuildContext context) {
    return IndexedStack(
      index: visited.indexOf(current),
      sizing: StackFit.expand,
      children: [
        for (final tab in visited)
          TickerMode(
            enabled: tab == current,
            child: RepaintBoundary(child: pages[tab]!),
          ),
      ],
    );
  }
}

class _AdminDrawer extends StatelessWidget {
  const _AdminDrawer({
    required this.current,
    required this.destinations,
    required this.userLabel,
    required this.onChanged,
    required this.onLogout,
  });

  final AdminTab current;
  final List<AdminDestination> destinations;
  final String userLabel;
  final ValueChanged<AdminTab> onChanged;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(
                tokens.spaceMd,
                tokens.spaceLg,
                tokens.spaceMd,
                tokens.spaceMd,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Admin navigation',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  SizedBox(height: tokens.spaceXs),
                  Text(
                    userLabel,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                        ),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: ListView(
                padding: EdgeInsets.symmetric(vertical: tokens.spaceSm),
                children: [
                  for (final destination in destinations)
                    ListTile(
                      minTileHeight: 48,
                      leading: Icon(destination.icon),
                      title: Text(destination.label),
                      selected: current == destination.id,
                      onTap: () {
                        Navigator.of(context).pop();
                        onChanged(destination.id);
                      },
                    ),
                ],
              ),
            ),
            const Divider(),
            ListTile(
              minTileHeight: 48,
              leading: const Icon(Icons.logout),
              title: const Text('Log out'),
              onTap: () {
                Navigator.of(context).pop();
                onLogout();
              },
            ),
          ],
        ),
      ),
    );
  }
}
