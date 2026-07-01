import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

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

http.StreamedResponse _streamedResponse(
  String body,
  int statusCode, {
  Map<String, String>? headers,
}) {
  return http.StreamedResponse(
    Stream.value(utf8.encode(body)),
    statusCode,
    headers: headers ?? const {},
  );
}

http.StreamedResponse _streamedJson(Object body, int statusCode) {
  return _streamedResponse(
    jsonEncode(body),
    statusCode,
    headers: const {'Content-Type': 'application/json'},
  );
}

class _HandlerClient extends http.BaseClient {
  _HandlerClient(this._handler);

  final FutureOr<http.StreamedResponse> Function(http.BaseRequest request)
      _handler;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    return _handler(request);
  }
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

  test('admin API multipart refreshes and retries once after 401', () async {
    late final AuthStore auth;
    final seenAuthorization = <String?>[];
    var uploadRequestCount = 0;
    final client = _HandlerClient((request) async {
      await request.finalize().drain<void>();
      if (request.url.path == '/api/v1/auth/refresh') {
        return _streamedJson({
          'ok': true,
          'data': {
            'accessToken': _jwt('new-access'),
            'refreshToken': _jwt('new-refresh'),
            'tokenType': 'Bearer',
            'expiresIn': 900,
          },
        }, 200);
      }

      if (request.url.path == '/api/v1/admin/posts/images') {
        uploadRequestCount += 1;
        seenAuthorization.add(request.headers['Authorization']);
        if (uploadRequestCount == 1) {
          return _streamedResponse('{}', 401);
        }
        return _streamedJson({
          'ok': true,
          'data': {'url': '/images/uploaded.png'},
        }, 200);
      }

      return _streamedResponse('not found', 404);
    });
    auth = AuthStore(client: client);
    auth.baseUrl = 'https://api.example.com';
    await auth.saveTokens(
      accessToken: _jwt('old-access'),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );
    final api = AdminApiClient(auth, client: client);

    final result = await api.multipart(
      '/api/v1/admin/posts/images',
      fields: const {'postId': 'post-1'},
      files: [
        PickedUpload(
          name: 'cover.png',
          bytes: Uint8List.fromList(utf8.encode('image')),
          contentType: 'image/png',
        ),
      ],
    );

    expect(result['url'], '/images/uploaded.png');
    expect(uploadRequestCount, 2);
    expect(seenAuthorization, [
      'Bearer ${_jwt('old-access')}',
      'Bearer ${_jwt('new-access')}',
    ]);
  });

  test('admin API stream refreshes and retries once after 401', () async {
    late final AuthStore auth;
    final seenAuthorization = <String?>[];
    var streamRequestCount = 0;
    var unauthorizedStreamDrained = false;
    final client = _HandlerClient((request) async {
      await request.finalize().drain<void>();
      if (request.url.path == '/api/v1/auth/refresh') {
        return _streamedJson({
          'ok': true,
          'data': {
            'accessToken': _jwt('new-access'),
            'refreshToken': _jwt('new-refresh'),
            'tokenType': 'Bearer',
            'expiresIn': 900,
          },
        }, 200);
      }

      if (request.url.path == '/api/v1/admin/logs/stream') {
        streamRequestCount += 1;
        seenAuthorization.add(request.headers['Authorization']);
        if (streamRequestCount == 1) {
          return http.StreamedResponse(
            Stream<List<int>>.fromIterable([utf8.encode('expired')]).map(
              (chunk) {
                unauthorizedStreamDrained = true;
                return chunk;
              },
            ),
            401,
          );
        }
        return _streamedResponse('line one\n\nline two\n', 200);
      }

      return _streamedResponse('not found', 404);
    });
    auth = AuthStore(client: client);
    auth.baseUrl = 'https://api.example.com';
    await auth.saveTokens(
      accessToken: _jwt('old-access'),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );
    final api = AdminApiClient(auth, client: client);

    final lines = await api.streamLines('/api/v1/admin/logs/stream').toList();

    expect(lines, ['line one', 'line two']);
    expect(streamRequestCount, 2);
    expect(unauthorizedStreamDrained, isTrue);
    expect(seenAuthorization, [
      'Bearer ${_jwt('old-access')}',
      'Bearer ${_jwt('new-access')}',
    ]);
  });

  testWidgets('shows loading state before auth initialization', (tester) async {
    final auth = AuthStore();
    final api = AdminApiClient(auth);

    await tester.pumpWidget(AdminApp(auth: auth, api: api));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
