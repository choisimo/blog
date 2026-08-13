import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/auth_store.dart';
import 'pages/dashboard_page.dart';
import 'pages/login_page.dart';
import 'theme/admin_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthStore();
  await auth.init();
  final api = AdminApiClient(auth);
  runApp(AdminApp(auth: auth, api: api));
}

class AdminApp extends StatelessWidget {
  const AdminApp({super.key, required this.auth, required this.api});

  final AuthStore auth;
  final AdminApiClient api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'noblog admin',
      debugShowCheckedModeBanner: false,
      theme: AdminTheme.light(),
      darkTheme: AdminTheme.dark(),
      themeMode: ThemeMode.system,
      home: _AuthGate(auth: auth, api: api),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate({required this.auth, required this.api});

  final AuthStore auth;
  final AdminApiClient api;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        if (!auth.initialized) {
          return Scaffold(
            body: Center(
              child: Semantics(
                liveRegion: true,
                label: 'Initializing admin session',
                child: const CircularProgressIndicator(),
              ),
            ),
          );
        }
        if (auth.isAuthenticated) {
          return DashboardPage(auth: auth, api: api);
        }
        return LoginPage(auth: auth);
      },
    );
  }
}
