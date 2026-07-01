import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'json_utils.dart';

class AuthStore extends ChangeNotifier {
  AuthStore({http.Client? client}) : _client = client ?? http.Client();

  static const _secureStorage = FlutterSecureStorage();
  static const defaultBaseUrl = String.fromEnvironment(
    'ADMIN_API_BASE_URL',
    defaultValue: 'https://api.nodove.com',
  );
  static const _baseUrlKey = 'noblog.admin.baseUrl';
  static const _accessTokenKey = 'noblog.admin.accessToken';
  static const _refreshTokenKey = 'noblog.admin.refreshToken';
  static const _userKey = 'noblog.admin.user';

  final http.Client _client;

  String baseUrl = defaultBaseUrl;
  String? accessToken;
  String? refreshToken;
  Map<String, dynamic>? user;
  bool initialized = false;

  bool get isAuthenticated => accessToken != null && refreshToken != null;
  String get userLabel =>
      (user?['email'] ?? user?['username'] ?? user?['role'] ?? 'admin')
          .toString();

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedBaseUrl = prefs.getString(_baseUrlKey);
    baseUrl = _initialBaseUrl(savedBaseUrl);
    if (savedBaseUrl != baseUrl) {
      await prefs.setString(_baseUrlKey, baseUrl);
    }
    accessToken = await _secureStorage.read(key: _accessTokenKey) ??
        prefs.getString(_accessTokenKey);
    refreshToken = await _secureStorage.read(key: _refreshTokenKey) ??
        prefs.getString(_refreshTokenKey);
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
    initialized = true;
    notifyListeners();
  }

  Future<void> setBaseUrl(String value) async {
    baseUrl = normalizeBaseUrl(value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseUrlKey, baseUrl);
    notifyListeners();
  }

  static String _initialBaseUrl(String? savedBaseUrl) {
    if (savedBaseUrl == null || savedBaseUrl.trim().isEmpty) {
      return normalizeBaseUrl(defaultBaseUrl);
    }
    if (_isLoopbackBaseUrl(savedBaseUrl)) {
      return normalizeBaseUrl(defaultBaseUrl);
    }
    return normalizeBaseUrl(savedBaseUrl);
  }

  static bool _isLoopbackBaseUrl(String value) {
    final normalized = normalizeBaseUrl(value);
    final uri = Uri.tryParse(normalized);
    final host = uri?.host.toLowerCase();
    return host == 'localhost' || host == '127.0.0.1' || host == '::1';
  }

  Uri uri(String path, [Map<String, String?> query = const {}]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final filtered = <String, String>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value != null && value.trim().isNotEmpty) filtered[entry.key] = value;
    }
    return Uri.parse('$baseUrl$cleanPath')
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
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = user ?? this.user;
    final prefs = await SharedPreferences.getInstance();
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    if (this.user != null) {
      await prefs.setString(_userKey, jsonEncode(this.user));
    }
    notifyListeners();
  }

  Future<void> clearLocal() async {
    accessToken = null;
    refreshToken = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_userKey);
    notifyListeners();
  }

  Future<void> logout() async {
    final token = refreshToken;
    try {
      await _client.post(
        uri('/api/v1/auth/logout'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': token}),
      );
    } catch (_) {
      // Local logout still proceeds.
    }
    await clearLocal();
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

  Future<String?> refreshAccessTokenNow() async {
    if (refreshToken == null ||
        isTokenExpired(refreshToken!, bufferSeconds: 0)) {
      await clearLocal();
      return null;
    }
    final http.Response response;
    try {
      response = await _client.post(
        uri('/api/v1/auth/refresh'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      );
    } catch (_) {
      await clearLocal();
      return null;
    }
    final json = _tryDecodeMap(response.body);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        json?['ok'] != true ||
        json?['data'] == null) {
      await clearLocal();
      return null;
    }
    final data = asMap(json!['data']);
    await saveTokens(
      accessToken: data['accessToken'].toString(),
      refreshToken: data['refreshToken'].toString(),
      user: user,
    );
    return accessToken;
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
    final response = await _client.get(uri('/api/v1/auth/totp/status'));
    return _unwrap(response, 'Failed to load TOTP status');
  }

  Future<Map<String, dynamic>> getTotpSetup({String? setupToken}) async {
    final response = await _client.get(
      uri('/api/v1/auth/totp/setup'),
      headers: <String, String>{
        if (setupToken != null && setupToken.isNotEmpty)
          'Setup-Token': setupToken
      },
    );
    return _unwrap(response, 'Failed to load TOTP setup');
  }

  Future<Map<String, dynamic>> verifyTotpSetup(String code,
      {String? setupToken}) async {
    final response = await _client.post(
      uri('/api/v1/auth/totp/setup/verify'),
      headers: <String, String>{
        'Content-Type': 'application/json',
        if (setupToken != null && setupToken.isNotEmpty)
          'Setup-Token': setupToken,
      },
      body: jsonEncode({'code': code}),
    );
    return _unwrap(response, 'TOTP setup verification failed');
  }

  Future<String> createTotpChallenge() async {
    final response = await _client.post(
      uri('/api/v1/auth/totp/challenge'),
      headers: const {'Content-Type': 'application/json'},
    );
    final data = await _unwrap(response, 'Failed to create TOTP challenge');
    return data['challengeId'].toString();
  }

  Future<void> verifyTotpCode(String challengeId, String code) async {
    final response = await _client.post(
      uri('/api/v1/auth/totp/verify'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'challengeId': challengeId, 'code': code}),
    );
    final data = await _unwrap(response, 'TOTP verification failed');
    await saveTokens(
      accessToken: data['accessToken'].toString(),
      refreshToken: data['refreshToken'].toString(),
      user: asMap(data['user']),
    );
  }

  Future<void> consumeOAuthHandoff(String handoff) async {
    final response = await _client.post(
      uri('/api/v1/auth/oauth/handoff/consume'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'handoff': handoff}),
    );
    final data = await _unwrap(response, 'OAuth handoff failed');
    await saveTokens(
      accessToken: data['accessToken'].toString(),
      refreshToken: data['refreshToken'].toString(),
      user: asMap(data['user']),
    );
  }

  Future<Map<String, dynamic>> getMe() async {
    final token = await getValidAccessToken();
    if (token == null) throw Exception('Not authenticated');
    final response = await _client.get(uri('/api/v1/auth/me'),
        headers: {'Authorization': 'Bearer $token'});
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
}
