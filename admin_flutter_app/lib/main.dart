import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/auth_store.dart';
import 'pages/dashboard_page.dart';
import 'pages/login_page.dart';

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
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        return MaterialApp(
          title: 'noblog admin',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme:
                ColorScheme.fromSeed(seedColor: const Color(0xFF18181B)),
            useMaterial3: true,
            visualDensity: VisualDensity.standard,
          ),
          home: !auth.initialized
              ? const Scaffold(body: Center(child: CircularProgressIndicator()))
              : auth.isAuthenticated
                  ? DashboardPage(auth: auth, api: api)
                  : LoginPage(auth: auth),
        );
      },
    );
  }
}
