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
import 'package:noblog_admin_flutter/core/json_utils.dart';
import 'package:noblog_admin_flutter/main.dart';

String _jwt(String subject, {int expiresAt = 4102444800}) {
  final header = base64Url
      .encode(utf8.encode(jsonEncode({'alg': 'none', 'typ': 'JWT'})))
      .replaceAll('=', '');
  final payload = base64Url
      .encode(utf8.encode(jsonEncode({
        'sub': subject,
        'exp': expiresAt,
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

class _BlockingSecureStorage implements AdminSecureStorage {
  final Map<String, String> values = {};
  String? _blockedKey;
  Completer<void>? _writeStarted;
  Completer<void>? _releaseWrite;

  Future<void> blockNextWrite(String key) {
    _blockedKey = key;
    _writeStarted = Completer<void>();
    _releaseWrite = Completer<void>();
    return _writeStarted!.future;
  }

  void releaseWrite() => _releaseWrite?.complete();

  @override
  Future<String?> read({required String key}) async => values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    if (key == _blockedKey) {
      _blockedKey = null;
      _writeStarted?.complete();
      await _releaseWrite!.future;
    }
    values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    values.remove(key);
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

  test('allows HTTPS origins and HTTP only for loopback development', () {
    expect(normalizeBaseUrl('https://Admin.Example.com/'),
        'https://admin.example.com');
    expect(normalizeBaseUrl('http://localhost:5080'), 'http://localhost:5080');
    expect(normalizeBaseUrl('http://127.0.0.1:5080/'), 'http://127.0.0.1:5080');

    expect(() => normalizeBaseUrl('http://admin.example.com'),
        throwsFormatException);
    expect(() => normalizeBaseUrl('https://user:pass@admin.example.com'),
        throwsFormatException);
    expect(() => normalizeBaseUrl('https://admin.example.com/api'),
        throwsFormatException);
    expect(() => normalizeBaseUrl('https://admin.example.com?tenant=a'),
        throwsFormatException);
  });

  test('changing API origin clears the bound session', () async {
    final auth = AuthStore();
    await auth.init();
    await auth.saveTokens(
      accessToken: _jwt('access'),
      refreshToken: _jwt('refresh'),
      user: {'role': 'admin'},
    );

    await auth.setBaseUrl('http://localhost:5081');

    const secureStorage = FlutterSecureStorage();
    expect(auth.baseUrl, 'http://localhost:5081');
    expect(auth.isAuthenticated, isFalse);
    expect(auth.user, isNull);
    expect(await secureStorage.read(key: 'noblog.admin.accessToken'), isNull);
    expect(await secureStorage.read(key: 'noblog.admin.refreshToken'), isNull);
  });

  test('rejects HTTPS API origins that are not build-time allowlisted',
      () async {
    final auth = AuthStore();
    await auth.init();

    await expectLater(
      auth.setBaseUrl('https://attacker.example.com'),
      throwsFormatException,
    );

    expect(auth.baseUrl, AuthStore.defaultBaseUrl);
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
    expect(await secureStorage.read(key: 'noblog.admin.sessionOrigin'),
        AuthStore.defaultBaseUrl);
  });

  test('discards stored tokens when their bound origin differs', () async {
    SharedPreferences.setMockInitialValues({
      'noblog.admin.baseUrl': AuthStore.defaultBaseUrl,
      'noblog.admin.user': jsonEncode({'role': 'admin'}),
    });
    FlutterSecureStorage.setMockInitialValues({
      'noblog.admin.accessToken': _jwt('access'),
      'noblog.admin.refreshToken': _jwt('refresh'),
      'noblog.admin.sessionOrigin': 'http://localhost:5080',
    });
    final auth = AuthStore();

    await auth.init();

    expect(auth.isAuthenticated, isFalse);
    expect(auth.user, isNull);
    const secureStorage = FlutterSecureStorage();
    expect(await secureStorage.read(key: 'noblog.admin.accessToken'), isNull);
    expect(await secureStorage.read(key: 'noblog.admin.refreshToken'), isNull);
    expect(await secureStorage.read(key: 'noblog.admin.sessionOrigin'), isNull);
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

  test('rejects tokens containing whitespace or control characters', () async {
    final auth = AuthStore();

    await expectLater(
      auth.saveTokens(
        accessToken: 'access\nheader-injection',
        refreshToken: 'refresh-token',
      ),
      throwsFormatException,
    );
    await expectLater(
      auth.saveTokens(
        accessToken: ' access-token',
        refreshToken: 'refresh-token',
      ),
      throwsFormatException,
    );

    expect(auth.isAuthenticated, isFalse);
  });

  test('coalesces concurrent refresh attempts into one rotation', () async {
    final releaseRefresh = Completer<void>();
    var refreshRequestCount = 0;
    final client = MockClient((request) async {
      if (request.url.path != '/api/v1/auth/refresh') {
        return http.Response('not found', 404);
      }
      refreshRequestCount += 1;
      await releaseRefresh.future;
      return http.Response(
        jsonEncode({
          'ok': true,
          'data': {
            'accessToken': _jwt('new-access'),
            'refreshToken': _jwt('new-refresh'),
          },
        }),
        200,
      );
    });
    final auth = AuthStore(client: client);
    await auth.setBaseUrl('http://localhost:5080');
    await auth.saveTokens(
      accessToken: _jwt('expired-access', expiresAt: 1),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );

    final first = auth.refreshAccessTokenNow();
    final second = auth.refreshAccessTokenNow();
    await Future<void>.delayed(Duration.zero);

    expect(identical(first, second), isTrue);
    expect(refreshRequestCount, 1);
    releaseRefresh.complete();
    expect(await Future.wait([first, second]), [
      _jwt('new-access'),
      _jwt('new-access'),
    ]);
    expect(auth.refreshToken, _jwt('new-refresh'));
  });

  test('preserves the session after a transient refresh transport failure',
      () async {
    final client = MockClient(
        (_) async => throw http.ClientException('network unavailable'));
    final auth = AuthStore(client: client);
    await auth.setBaseUrl('http://localhost:5080');
    final oldRefresh = _jwt('old-refresh');
    await auth.saveTokens(
      accessToken: _jwt('expired-access', expiresAt: 1),
      refreshToken: oldRefresh,
      user: {'role': 'admin'},
    );

    expect(await auth.refreshAccessTokenNow(), isNull);
    expect(auth.refreshToken, oldRefresh);
    expect(auth.user, {'role': 'admin'});
  });

  test('preserves the session after a transient refresh server failure',
      () async {
    final client = MockClient((_) async => http.Response(
          jsonEncode({
            'ok': false,
            'error': {'message': 'temporarily unavailable'},
          }),
          503,
        ));
    final auth = AuthStore(client: client);
    await auth.setBaseUrl('http://localhost:5080');
    final oldRefresh = _jwt('old-refresh');
    await auth.saveTokens(
      accessToken: _jwt('expired-access', expiresAt: 1),
      refreshToken: oldRefresh,
      user: {'role': 'admin'},
    );

    expect(await auth.refreshAccessTokenNow(), isNull);
    expect(auth.refreshToken, oldRefresh);
    expect(auth.user, {'role': 'admin'});
  });

  test('logout wins when refresh persistence is already in progress', () async {
    final storage = _BlockingSecureStorage();
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/refresh') {
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {
              'accessToken': _jwt('new-access'),
              'refreshToken': _jwt('new-refresh'),
            },
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/auth/logout') {
        return http.Response(jsonEncode({'ok': true}), 200);
      }
      return http.Response('not found', 404);
    });
    final auth = AuthStore(client: client, secureStorage: storage);
    await auth.saveTokens(
      accessToken: _jwt('old-access'),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );
    final writeStarted = storage.blockNextWrite('noblog.admin.sessionOrigin');

    final refresh = auth.refreshAccessTokenNow();
    await writeStarted;
    final logout = auth.logout();
    expect(auth.isAuthenticated, isFalse);

    storage.releaseWrite();
    expect(await refresh, isNull);
    await logout;

    expect(auth.isAuthenticated, isFalse);
    expect(storage.values, isEmpty);
  });

  test('origin change wins when refresh persistence is already in progress',
      () async {
    final storage = _BlockingSecureStorage();
    final client = MockClient((_) async => http.Response(
          jsonEncode({
            'ok': true,
            'data': {
              'accessToken': _jwt('new-access'),
              'refreshToken': _jwt('new-refresh'),
            },
          }),
          200,
        ));
    final auth = AuthStore(client: client, secureStorage: storage);
    await auth.saveTokens(
      accessToken: _jwt('old-access'),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );
    final writeStarted = storage.blockNextWrite('noblog.admin.sessionOrigin');

    final refresh = auth.refreshAccessTokenNow();
    await writeStarted;
    final changeOrigin = auth.setBaseUrl('http://localhost:5080');
    expect(auth.baseUrl, 'http://localhost:5080');
    expect(auth.isAuthenticated, isFalse);

    storage.releaseWrite();
    expect(await refresh, isNull);
    await changeOrigin;

    expect(auth.isAuthenticated, isFalse);
    expect(storage.values, isEmpty);
  });

  test('finite API requests honor their timeout', () async {
    final never = Completer<http.Response>();
    final auth = AuthStore();
    await auth.setBaseUrl('http://localhost:5080');
    final api = AdminApiClient(
      auth,
      client: MockClient((_) => never.future),
      requestTimeout: const Duration(milliseconds: 5),
    );

    await expectLater(
      api.get('/health', authRequired: false),
      throwsA(isA<TimeoutException>()),
    );
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
    await auth.setBaseUrl('http://localhost:5080');
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

  test('mutation retry reuses one generated idempotency key', () async {
    late final AuthStore auth;
    final seenKeys = <String?>[];
    var mutationRequestCount = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/refresh') {
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {
              'accessToken': _jwt('new-access'),
              'refreshToken': _jwt('new-refresh'),
            },
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/admin/mutation') {
        mutationRequestCount += 1;
        seenKeys.add(request.headers['Idempotency-Key']);
        return mutationRequestCount == 1
            ? http.Response('{}', 401)
            : http.Response(
                jsonEncode({
                  'ok': true,
                  'data': {'saved': true}
                }),
                200);
      }
      return http.Response('not found', 404);
    });
    auth = AuthStore(client: client);
    await auth.setBaseUrl('http://localhost:5080');
    await auth.saveTokens(
      accessToken: _jwt('old-access'),
      refreshToken: _jwt('old-refresh'),
      user: {'role': 'admin'},
    );
    final api = AdminApiClient(auth, client: client);

    final result = await api.post('/api/v1/admin/mutation', body: {'x': 1});

    expect(result['saved'], isTrue);
    expect(seenKeys, hasLength(2));
    expect(seenKeys.first, startsWith('flutter-admin-'));
    expect(seenKeys.last, seenKeys.first);
  });

  test('admin API multipart refreshes and retries once after 401', () async {
    late final AuthStore auth;
    final seenAuthorization = <String?>[];
    final seenIdempotencyKeys = <String?>[];
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
        seenIdempotencyKeys.add(request.headers['Idempotency-Key']);
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
    await auth.setBaseUrl('http://localhost:5080');
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
    expect(seenIdempotencyKeys, hasLength(2));
    expect(seenIdempotencyKeys.first, startsWith('flutter-admin-'));
    expect(seenIdempotencyKeys.last, seenIdempotencyKeys.first);
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
    await auth.setBaseUrl('http://localhost:5080');
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
