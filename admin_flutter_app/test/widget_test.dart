import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/main.dart';

void main() {
  test('uses production API by default', () async {
    SharedPreferences.setMockInitialValues({});
    final auth = AuthStore();

    await auth.init();

    expect(auth.baseUrl, 'https://api.nodove.com');
  });

  test('migrates old loopback API default to production API', () async {
    SharedPreferences.setMockInitialValues({
      'noblog.admin.baseUrl': 'http://localhost:5080',
    });
    final auth = AuthStore();

    await auth.init();

    expect(auth.baseUrl, 'https://api.nodove.com');
  });

  testWidgets('shows loading state before auth initialization', (tester) async {
    final auth = AuthStore();
    final api = AdminApiClient(auth);

    await tester.pumpWidget(AdminApp(auth: auth, api: api));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
