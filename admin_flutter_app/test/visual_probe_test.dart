import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/pages/dashboard_page.dart';
import 'package:noblog_admin_flutter/theme/admin_theme.dart';

String _jwt() {
  final header = base64Url
      .encode(utf8.encode(jsonEncode({'alg': 'none'})))
      .replaceAll('=', '');
  final payload = base64Url
      .encode(utf8.encode(jsonEncode({'exp': 4102444800})))
      .replaceAll('=', '');
  return '$header.$payload.visual';
}

void main() {
  testWidgets('manual visual QA captures adaptive admin shell', (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = MockClient((request) async => http.Response(
          jsonEncode({
            'ok': true,
            'data': {
              'status': 'healthy',
              'service': request.url.path,
              'checkedAt': '2026-08-12T12:00:00.000Z',
            },
          }),
          200,
        ));
    final auth = AuthStore(client: client)
      ..accessToken = _jwt()
      ..refreshToken = _jwt()
      ..user = {'email': 'operations.admin@nodove.com'};
    final api = AdminApiClient(auth, client: client);

    await tester.binding.setSurfaceSize(const Size(1440, 900));
    await tester.pumpWidget(MaterialApp(
      theme: AdminTheme.light(),
      darkTheme: AdminTheme.dark(),
      home: DashboardPage(auth: auth, api: api),
    ));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('../verification/admin-dashboard-desktop.png'),
    );

    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('../verification/admin-dashboard-mobile-drawer.png'),
    );

    await tester.binding.setSurfaceSize(const Size(1200, 800));
    await tester.pumpWidget(MaterialApp(
      theme: AdminTheme.light(),
      darkTheme: AdminTheme.dark(),
      themeMode: ThemeMode.dark,
      home: DashboardPage(auth: auth, api: api),
    ));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('../verification/admin-dashboard-dark.png'),
    );

    client.close();
  });
}
