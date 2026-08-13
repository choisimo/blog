import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'json_utils.dart';

abstract interface class AdminSecureStorage {
  Future<String?> read({required String key});

  Future<void> write({required String key, required String value});

  Future<void> delete({required String key});
}

class FlutterAdminSecureStorage implements AdminSecureStorage {
  const FlutterAdminSecureStorage();

  static const _delegate = FlutterSecureStorage();

  @override
  Future<String?> read({required String key}) => _delegate.read(key: key);

  @override
  Future<void> write({required String key, required String value}) =>
      _delegate.write(key: key, value: value);

  @override
  Future<void> delete({required String key}) => _delegate.delete(key: key);
}

class AuthStore extends ChangeNotifier {
  AuthStore({
    http.Client? client,
    AdminSecureStorage? secureStorage,
    this.requestTimeout = const Duration(seconds: 30),
  })  : _client = client ?? http.Client(),
        _secureStorage = secureStorage ?? const FlutterAdminSecureStorage();

  static const defaultBaseUrl = String.fromEnvironment(
    'ADMIN_API_BASE_URL',
    defaultValue: 'https://api.nodove.com',
  );
  static const allowedApiOrigins = String.fromEnvironment(
    'ADMIN_API_ALLOWED_ORIGINS',
    defaultValue: '',
  );
  static const _baseUrlKey = 'noblog.admin.baseUrl';
  static const _accessTokenKey = 'noblog.admin.accessToken';
  static const _refreshTokenKey = 'noblog.admin.refreshToken';
  static const _sessionOriginKey = 'noblog.admin.sessionOrigin';
  static const _userKey = 'noblog.admin.user';

  final http.Client _client;
  final AdminSecureStorage _secureStorage;
  final Duration requestTimeout;
  Future<String?>? _refreshInFlight;
  Future<void> _sessionMutationTail = Future<void>.value();
  int _sessionGeneration = 0;

  String _baseUrl = defaultBaseUrl;
  String? accessToken;
  String? refreshToken;
  Map<String, dynamic>? user;
  bool initialized = false;

  String get baseUrl => _baseUrl;
  bool get isAuthenticated => accessToken != null && refreshToken != null;
  String get userLabel =>
      (user?['email'] ?? user?['username'] ?? user?['role'] ?? 'admin')
          .toString();

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedBaseUrl = prefs.getString(_baseUrlKey);
    _baseUrl = _initialBaseUrl(savedBaseUrl);
    if (savedBaseUrl != _baseUrl) {
      await prefs.setString(_baseUrlKey, _baseUrl);
    }
    final secureAccessToken = await _secureStorage.read(key: _accessTokenKey);
    final secureRefreshToken = await _secureStorage.read(key: _refreshTokenKey);
    accessToken =
        _normalizeToken(secureAccessToken ?? prefs.getString(_accessTokenKey));
    refreshToken = _normalizeToken(
        secureRefreshToken ?? prefs.getString(_refreshTokenKey));
    if (secureAccessToken != null && accessToken == null) {
      await _secureStorage.delete(key: _accessTokenKey);
    }
    if (secureRefreshToken != null && refreshToken == null) {
      await _secureStorage.delete(key: _refreshTokenKey);
    }
    if (prefs.getString(_accessTokenKey) != null ||
        prefs.getString(_refreshTokenKey) != null) {
      await _migratePlaintextTokens(prefs);
    }
    final rawUser = prefs.getString(_userKey);
    if (rawUser != null && rawUser.trim().isNotEmpty) {
      try {
        user = asMap(jsonDecode(rawUser));
      } catch (_) {
        user = null;
      }
    }
    await _enforceSessionOrigin(prefs);
    initialized = true;
    notifyListeners();
  }

  Future<void> setBaseUrl(String value) async {
    final nextBaseUrl = _validatedBaseUrl(value);
    if (nextBaseUrl == _baseUrl) {
      await _serializeSessionMutation(() async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_baseUrlKey, nextBaseUrl);
      });
      return;
    }

    // Invalidate refresh completions synchronously before any storage await.
    _baseUrl = nextBaseUrl;
    _invalidateSessionInMemory();
    notifyListeners();
    await _serializeSessionMutation(() async {
      final prefs = await SharedPreferences.getInstance();
      await _deleteSessionStorage(prefs);
      await prefs.setString(_baseUrlKey, nextBaseUrl);
    });
  }

  static String _initialBaseUrl(String? savedBaseUrl) {
    if (savedBaseUrl == null || savedBaseUrl.trim().isEmpty) {
      return _validatedBaseUrl(defaultBaseUrl);
    }
    try {
      if (_isLoopbackBaseUrl(savedBaseUrl)) {
        return _validatedBaseUrl(defaultBaseUrl);
      }
      return _validatedBaseUrl(savedBaseUrl);
    } on FormatException {
      return _validatedBaseUrl(defaultBaseUrl);
    }
  }

  static String _validatedBaseUrl(String value) {
    final normalized = normalizeBaseUrl(value);
    if (_isLoopbackBaseUrl(normalized)) return normalized;

    final allowed = <String>{normalizeBaseUrl(defaultBaseUrl)};
    for (final configured in allowedApiOrigins.split(',')) {
      if (configured.trim().isEmpty) continue;
      try {
        allowed.add(normalizeBaseUrl(configured));
      } on FormatException {
        // Invalid build-time entries grant no access.
      }
    }
    if (!allowed.contains(normalized)) {
      throw const FormatException(
        'API origin is not allowlisted. Add it with '
        'ADMIN_API_ALLOWED_ORIGINS at build time.',
      );
    }
    return normalized;
  }

  static bool _isLoopbackBaseUrl(String value) {
    try {
      final normalized = normalizeBaseUrl(value);
      final host = Uri.parse(normalized).host.toLowerCase();
      return host == 'localhost' || host == '127.0.0.1' || host == '::1';
    } on FormatException {
      return false;
    }
  }

  Uri uri(String path, [Map<String, String?> query = const {}]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final filtered = <String, String>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value != null && value.trim().isNotEmpty) filtered[entry.key] = value;
    }
    return Uri.parse('$_baseUrl$cleanPath')
        .replace(queryParameters: filtered.isEmpty ? null : filtered);
  }

  Map<String, String> bearerHeaders([Map<String, String> extra = const {}]) {
    return <String, String>{
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
      ...extra,
    };
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    Map<String, dynamic>? user,
  }) async {
    final nextAccessToken = _requireToken(accessToken, 'access token');
    final nextRefreshToken = _requireToken(refreshToken, 'refresh token');
    final nextUser = user ?? this.user;
    final generation = ++_sessionGeneration;
    final origin = _baseUrl;

    await _serializeSessionMutation(() async {
      if (!_ownsSessionMutation(generation, origin)) return;
      await _persistSession(
        origin: origin,
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        user: nextUser,
      );
      if (!_ownsSessionMutation(generation, origin)) return;
      this.accessToken = nextAccessToken;
      this.refreshToken = nextRefreshToken;
      this.user = nextUser;
      notifyListeners();
    });
  }

  Future<void> clearLocal() async {
    _invalidateSessionInMemory();
    notifyListeners();
    await _serializeSessionMutation(() async {
      final prefs = await SharedPreferences.getInstance();
      await _deleteSessionStorage(prefs);
    });
  }

  void _invalidateSessionInMemory() {
    _sessionGeneration += 1;
    accessToken = null;
    refreshToken = null;
    user = null;
  }

  Future<void> _deleteSessionStorage(SharedPreferences prefs) async {
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _sessionOriginKey);
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_userKey);
  }

  Future<void> _enforceSessionOrigin(SharedPreferences prefs) async {
    if (accessToken == null && refreshToken == null) {
      if (user != null) {
        _invalidateSessionInMemory();
        await _deleteSessionStorage(prefs);
      }
      return;
    }
    if (accessToken == null || refreshToken == null) {
      _invalidateSessionInMemory();
      await _deleteSessionStorage(prefs);
      return;
    }

    final storedOrigin = await _secureStorage.read(key: _sessionOriginKey);
    if (storedOrigin == null) {
      final productionOrigin = _validatedBaseUrl(defaultBaseUrl);
      if (_baseUrl == productionOrigin) {
        // One-time migration for sessions created before origin binding.
        await _secureStorage.write(
          key: _sessionOriginKey,
          value: productionOrigin,
        );
      } else {
        _invalidateSessionInMemory();
        await _deleteSessionStorage(prefs);
      }
      return;
    }

    String normalizedOrigin;
    try {
      normalizedOrigin = _validatedBaseUrl(storedOrigin);
    } on FormatException {
      _invalidateSessionInMemory();
      await _deleteSessionStorage(prefs);
      return;
    }
    if (normalizedOrigin != _baseUrl) {
      _invalidateSessionInMemory();
      await _deleteSessionStorage(prefs);
    }
  }

  Future<void> logout() async {
    final token = refreshToken;
    final logoutUri = uri('/api/v1/auth/logout');
    await clearLocal();
    try {
      await _client
          .post(
            logoutUri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': token}),
          )
          .timeout(requestTimeout);
    } catch (_) {
      // Local logout still proceeds.
    }
  }

  bool isTokenExpired(String token, {int bufferSeconds = 60}) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
      if (payload is! Map || payload['exp'] is! num) return true;
      final expiresAt = DateTime.fromMillisecondsSinceEpoch(
          (payload['exp'] as num).toInt() * 1000);
      return DateTime.now()
          .add(Duration(seconds: bufferSeconds))
          .isAfter(expiresAt);
    } catch (_) {
      return true;
    }
  }

  Future<String?> getValidAccessToken() async {
    if (accessToken != null && !isTokenExpired(accessToken!)) {
      return accessToken;
    }
    return refreshAccessTokenNow();
  }

  Future<String?> refreshAccessTokenNow() {
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    late final Future<String?> refresh;
    refresh = _performRefresh().whenComplete(() {
      if (identical(_refreshInFlight, refresh)) {
        _refreshInFlight = null;
      }
    });
    _refreshInFlight = refresh;
    return refresh;
  }

  Future<String?> _performRefresh() async {
    final initiatingRefreshToken = refreshToken;
    final initiatingGeneration = _sessionGeneration;
    final initiatingOrigin = _baseUrl;
    if (initiatingRefreshToken == null ||
        isTokenExpired(initiatingRefreshToken, bufferSeconds: 0)) {
      if (_ownsRefresh(
        initiatingRefreshToken,
        initiatingGeneration,
        initiatingOrigin,
      )) {
        await clearLocal();
      }
      return null;
    }
    final http.Response response;
    try {
      response = await _client
          .post(
            uri('/api/v1/auth/refresh'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': initiatingRefreshToken}),
          )
          .timeout(requestTimeout);
    } catch (_) {
      // Preserve the refresh token on transient transport failures so the
      // session can recover when connectivity returns.
      return null;
    }
    if (!_ownsRefresh(
      initiatingRefreshToken,
      initiatingGeneration,
      initiatingOrigin,
    )) {
      return null;
    }
    final json = _tryDecodeMap(response.body);
    if (response.statusCode == 408 ||
        response.statusCode == 429 ||
        response.statusCode >= 500) {
      return null;
    }
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        json?['ok'] != true ||
        json?['data'] == null) {
      if (_ownsRefresh(
        initiatingRefreshToken,
        initiatingGeneration,
        initiatingOrigin,
      )) {
        await clearLocal();
      }
      return null;
    }
    final data = asMap(json!['data']);
    final nextAccessToken = data['accessToken'];
    final nextRefreshToken = data['refreshToken'];
    if (nextAccessToken is! String || nextRefreshToken is! String) {
      if (_ownsRefresh(
        initiatingRefreshToken,
        initiatingGeneration,
        initiatingOrigin,
      )) {
        await clearLocal();
      }
      return null;
    }
    late final String normalizedAccessToken;
    late final String normalizedRefreshToken;
    try {
      normalizedAccessToken = _requireToken(nextAccessToken, 'access token');
      normalizedRefreshToken = _requireToken(nextRefreshToken, 'refresh token');
    } on FormatException {
      if (_ownsRefresh(
        initiatingRefreshToken,
        initiatingGeneration,
        initiatingOrigin,
      )) {
        await clearLocal();
      }
      return null;
    }

    final initiatingUser = user;
    return _serializeSessionMutation(() async {
      if (!_ownsRefresh(
        initiatingRefreshToken,
        initiatingGeneration,
        initiatingOrigin,
      )) {
        return null;
      }
      await _persistSession(
        origin: initiatingOrigin,
        accessToken: normalizedAccessToken,
        refreshToken: normalizedRefreshToken,
        user: initiatingUser,
      );
      if (!_ownsRefresh(
        initiatingRefreshToken,
        initiatingGeneration,
        initiatingOrigin,
      )) {
        return null;
      }
      accessToken = normalizedAccessToken;
      refreshToken = normalizedRefreshToken;
      user = initiatingUser;
      notifyListeners();
      return normalizedAccessToken;
    });
  }

  bool _ownsRefresh(
    String? initiatingRefreshToken,
    int initiatingGeneration,
    String initiatingOrigin,
  ) {
    return refreshToken == initiatingRefreshToken &&
        _ownsSessionMutation(initiatingGeneration, initiatingOrigin);
  }

  bool _ownsSessionMutation(int generation, String origin) {
    return _sessionGeneration == generation && _baseUrl == origin;
  }

  Future<void> _persistSession({
    required String origin,
    required String accessToken,
    required String refreshToken,
    required Map<String, dynamic>? user,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await _secureStorage.write(key: _sessionOriginKey, value: origin);
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    if (user == null) {
      await prefs.remove(_userKey);
    } else {
      await prefs.setString(_userKey, jsonEncode(user));
    }
  }

  Future<T> _serializeSessionMutation<T>(Future<T> Function() mutation) {
    final previous = _sessionMutationTail;
    final release = Completer<void>();
    _sessionMutationTail = release.future;

    return (() async {
      await previous;
      try {
        return await mutation();
      } finally {
        release.complete();
      }
    })();
  }

  Future<void> _migratePlaintextTokens(SharedPreferences prefs) async {
    final plaintextAccessToken = prefs.getString(_accessTokenKey);
    final plaintextRefreshToken = prefs.getString(_refreshTokenKey);
    if (plaintextAccessToken != null && accessToken == plaintextAccessToken) {
      await _secureStorage.write(
          key: _accessTokenKey, value: plaintextAccessToken);
    }
    if (plaintextRefreshToken != null &&
        refreshToken == plaintextRefreshToken) {
      await _secureStorage.write(
          key: _refreshTokenKey, value: plaintextRefreshToken);
    }
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
  }

  Future<Map<String, dynamic>> getTotpStatus() async {
    final response = await _client
        .get(uri('/api/v1/auth/totp/status'))
        .timeout(requestTimeout);
    return _unwrap(response, 'Failed to load TOTP status');
  }

  Future<Map<String, dynamic>> getTotpSetup({String? setupToken}) async {
    final response = await _client.get(
      uri('/api/v1/auth/totp/setup'),
      headers: <String, String>{
        if (setupToken != null && setupToken.isNotEmpty)
          'Setup-Token': setupToken
      },
    ).timeout(requestTimeout);
    return _unwrap(response, 'Failed to load TOTP setup');
  }

  Future<Map<String, dynamic>> verifyTotpSetup(String code,
      {String? setupToken}) async {
    final response = await _client
        .post(
          uri('/api/v1/auth/totp/setup/verify'),
          headers: <String, String>{
            'Content-Type': 'application/json',
            if (setupToken != null && setupToken.isNotEmpty)
              'Setup-Token': setupToken,
          },
          body: jsonEncode({'code': code}),
        )
        .timeout(requestTimeout);
    return _unwrap(response, 'TOTP setup verification failed');
  }

  Future<String> createTotpChallenge() async {
    final response = await _client.post(
      uri('/api/v1/auth/totp/challenge'),
      headers: const {'Content-Type': 'application/json'},
    ).timeout(requestTimeout);
    final data = await _unwrap(response, 'Failed to create TOTP challenge');
    return data['challengeId'].toString();
  }

  Future<void> verifyTotpCode(String challengeId, String code) async {
    final response = await _client
        .post(
          uri('/api/v1/auth/totp/verify'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'challengeId': challengeId, 'code': code}),
        )
        .timeout(requestTimeout);
    final data = await _unwrap(response, 'TOTP verification failed');
    final accessToken = data['accessToken'];
    final refreshToken = data['refreshToken'];
    if (accessToken is! String || refreshToken is! String) {
      throw const FormatException(
          'Authentication response contains invalid tokens.');
    }
    await saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: asMap(data['user']),
    );
  }

  Future<void> consumeOAuthHandoff(String handoff) async {
    final response = await _client
        .post(
          uri('/api/v1/auth/oauth/handoff/consume'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'handoff': handoff}),
        )
        .timeout(requestTimeout);
    final data = await _unwrap(response, 'OAuth handoff failed');
    final accessToken = data['accessToken'];
    final refreshToken = data['refreshToken'];
    if (accessToken is! String || refreshToken is! String) {
      throw const FormatException(
          'Authentication response contains invalid tokens.');
    }
    await saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: asMap(data['user']),
    );
  }

  Future<Map<String, dynamic>> getMe() async {
    final token = await getValidAccessToken();
    if (token == null) throw Exception('Not authenticated');
    final response = await _client.get(uri('/api/v1/auth/me'),
        headers: {'Authorization': 'Bearer $token'}).timeout(requestTimeout);
    final data = await _unwrap(response, 'Failed to load user');
    return asMap(data['user']);
  }

  Future<Map<String, dynamic>> _unwrap(
      http.Response response, String fallback) async {
    final decoded = response.body.trim().isEmpty
        ? <String, dynamic>{}
        : asMap(jsonDecode(response.body));
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded['ok'] != true) {
      final error = decoded['error'];
      if (error is Map && error['message'] != null) {
        throw Exception(error['message']);
      }
      if (error != null) throw Exception(error.toString());
      throw Exception('$fallback (${response.statusCode})');
    }
    return asMap(decoded['data']);
  }

  Map<String, dynamic>? _tryDecodeMap(String body) {
    try {
      final trimmed = body.trim();
      if (trimmed.isEmpty) return <String, dynamic>{};
      final decoded = jsonDecode(trimmed);
      return decoded is Map ? asMap(decoded) : null;
    } catch (_) {
      return null;
    }
  }

  static String? _normalizeToken(String? value) {
    if (value == null) return null;
    if (value.isEmpty ||
        value.length > 4096 ||
        value != value.trim() ||
        RegExp(r'\s').hasMatch(value) ||
        RegExp(r'[\x00-\x1F\x7F]').hasMatch(value) ||
        RegExp(r'%(?:0a|0d)', caseSensitive: false).hasMatch(value)) {
      return null;
    }
    return value;
  }

  static String _requireToken(String value, String label) {
    final normalized = _normalizeToken(value);
    if (normalized == null) throw FormatException('Invalid $label.');
    return normalized;
  }
}
