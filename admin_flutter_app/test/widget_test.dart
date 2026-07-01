import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/main.dart';

String _jwt(String subject) {
  final header = base64Url
      .encode(utf8.encode(jsonEncode({'alg': 'none', 'typ': 'JWT'})))
      .replaceAll('=', '');
  final payload = base64Url
      .encode(utf8.encode(jsonEncode({
        'sub': subject,
        'exp': 4102444800,
      })))
      .replaceAll('=', '');
  return '$header.$payload.smoke';
}

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

  test('admin API client refreshes and retries once after 401', () async {
    late final AuthStore auth;
    final seenAuthorization = <String?>[];
    var configRequestCount = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/refresh') {
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {
              'accessToken': _jwt('new-access'),
              'refreshToken': _jwt('new-refresh'),
              'tokenType': 'Bearer',
              'expiresIn': 900,
            },
          }),
          200,
          headers: {'Content-Type': 'application/json'},
        );
      }

      if (request.url.path == '/api/v1/admin/config/current') {
        configRequestCount += 1;
        seenAuthorization.add(request.headers['Authorization']);
        if (configRequestCount == 1) {
          return http.Response('{}', 401);
        }
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {'saved': true},
          }),
          200,
          headers: {'Content-Type': 'application/json'},
        );
      }

      return http.Response('not found', 404);
    });
    auth = AuthStore(client: client);
    auth.baseUrl = 'https://api.example.com';
    await auth.saveTokens(
      accessToken: _jwt('old-access'),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );
    final api = AdminApiClient(auth, client: client);

    final result = await api.get('/api/v1/admin/config/current');

    expect(result['saved'], isTrue);
    expect(configRequestCount, 2);
    expect(seenAuthorization, [
      'Bearer ${_jwt('old-access')}',
      'Bearer ${_jwt('new-access')}',
    ]);
    expect(auth.accessToken, _jwt('new-access'));
    expect(auth.refreshToken, _jwt('new-refresh'));
  });

  testWidgets('shows loading state before auth initialization', (tester) async {
    final auth = AuthStore();
    final api = AdminApiClient(auth);

    await tester.pumpWidget(AdminApp(auth: auth, api: api));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
