import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/main.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  test('uses production API by default', () async {
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

  test('migrates plaintext tokens to secure storage', () async {
    SharedPreferences.setMockInitialValues({
      'noblog.admin.accessToken': 'plain-access',
      'noblog.admin.refreshToken': 'plain-refresh',
    });
    final auth = AuthStore();

    await auth.init();

    final prefs = await SharedPreferences.getInstance();
    const secureStorage = FlutterSecureStorage();
    expect(auth.accessToken, 'plain-access');
    expect(auth.refreshToken, 'plain-refresh');
    expect(prefs.getString('noblog.admin.accessToken'), isNull);
    expect(prefs.getString('noblog.admin.refreshToken'), isNull);
    expect(await secureStorage.read(key: 'noblog.admin.accessToken'),
        'plain-access');
    expect(await secureStorage.read(key: 'noblog.admin.refreshToken'),
        'plain-refresh');
  });

  test('stores new tokens outside shared preferences', () async {
    final auth = AuthStore();

    await auth.saveTokens(
      accessToken: 'secure-access',
      refreshToken: 'secure-refresh',
      user: {'role': 'admin'},
    );

    final prefs = await SharedPreferences.getInstance();
    const secureStorage = FlutterSecureStorage();
    expect(prefs.getString('noblog.admin.accessToken'), isNull);
    expect(prefs.getString('noblog.admin.refreshToken'), isNull);
    expect(await secureStorage.read(key: 'noblog.admin.accessToken'),
        'secure-access');
    expect(await secureStorage.read(key: 'noblog.admin.refreshToken'),
        'secure-refresh');
  });

  testWidgets('shows loading state before auth initialization', (tester) async {
    final auth = AuthStore();
    final api = AdminApiClient(auth);

    await tester.pumpWidget(AdminApp(auth: auth, api: api));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
