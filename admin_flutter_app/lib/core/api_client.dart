import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:uuid/uuid.dart';

import 'auth_store.dart';
import 'json_utils.dart';

class PickedUpload {
  const PickedUpload(
      {required this.name, required this.bytes, this.contentType});
  final String name;
  final Uint8List bytes;
  final String? contentType;
}

class AdminApiClient {
  AdminApiClient(
    this.auth, {
    http.Client? client,
    this.requestTimeout = const Duration(seconds: 45),
  }) : _client = client ?? http.Client();

  final AuthStore auth;
  final http.Client _client;
  final Duration requestTimeout;
  static const _uuid = Uuid();

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String?> query = const {},
    bool authRequired = true,
    Map<String, String> headers = const {},
    Duration? timeout,
  }) =>
      _request('GET', path,
          query: query,
          authRequired: authRequired,
          headers: headers,
          timeout: timeout);

  Future<Map<String, dynamic>> post(
    String path, {
    Object? body,
    Map<String, String?> query = const {},
    bool authRequired = true,
    Map<String, String> headers = const {},
    Duration? timeout,
  }) =>
      _request('POST', path,
          body: body,
          query: query,
          authRequired: authRequired,
          headers: headers,
          timeout: timeout);

  Future<Map<String, dynamic>> put(
    String path, {
    Object? body,
    Map<String, String?> query = const {},
    bool authRequired = true,
    Map<String, String> headers = const {},
    Duration? timeout,
  }) =>
      _request('PUT', path,
          body: body,
          query: query,
          authRequired: authRequired,
          headers: headers,
          timeout: timeout);

  Future<Map<String, dynamic>> delete(
    String path, {
    Object? body,
    Map<String, String?> query = const {},
    bool authRequired = true,
    Map<String, String> headers = const {},
    Duration? timeout,
  }) =>
      _request('DELETE', path,
          body: body,
          query: query,
          authRequired: authRequired,
          headers: headers,
          timeout: timeout);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Object? body,
    Map<String, String?> query = const {},
    bool authRequired = true,
    Map<String, String> headers = const {},
    Duration? timeout,
  }) async {
    final requestHeaders = <String, String>{
      'Content-Type': 'application/json',
      ...headers
    };
    if (method != 'GET' &&
        !_containsHeader(requestHeaders, 'Idempotency-Key')) {
      requestHeaders['Idempotency-Key'] = 'flutter-admin-${_uuid.v4()}';
    }
    if (authRequired) {
      final token = await auth.getValidAccessToken();
      if (token == null) {
        throw _authenticationFailure(
          loggedOutMessage: 'Not authenticated. Please log in again.',
        );
      }
      requestHeaders['Authorization'] = 'Bearer $token';
    }
    final uri = auth.uri(path, query);
    final encoded = body == null ? null : jsonEncode(body);
    var response =
        await _send(method, uri, requestHeaders, encoded, timeout: timeout);
    if (authRequired && response.statusCode == 401) {
      final token = await auth.refreshAccessTokenNow();
      if (token == null) {
        throw _authenticationFailure(
          loggedOutMessage: 'Session expired. Please log in again.',
        );
      }
      requestHeaders['Authorization'] = 'Bearer $token';
      response =
          await _send(method, uri, requestHeaders, encoded, timeout: timeout);
    }
    return _decode(response);
  }

  Future<http.Response> _send(
      String method, Uri uri, Map<String, String> headers, String? body,
      {Duration? timeout}) {
    final request = switch (method) {
      'GET' => _client.get(uri, headers: headers),
      'POST' => _client.post(uri, headers: headers, body: body),
      'PUT' => _client.put(uri, headers: headers, body: body),
      'DELETE' => _client.delete(uri, headers: headers, body: body),
      _ => throw UnsupportedError(method),
    };
    return request.timeout(timeout ?? requestTimeout);
  }

  Future<Map<String, dynamic>> multipart(
    String path, {
    required Map<String, String> fields,
    required List<PickedUpload> files,
    String fileField = 'files',
    Duration? timeout,
  }) async {
    final token = await auth.getValidAccessToken();
    if (token == null) {
      throw _authenticationFailure(
        loggedOutMessage: 'Not authenticated. Please log in again.',
      );
    }
    final idempotencyKey = 'flutter-admin-${_uuid.v4()}';
    var response = await http.Response.fromStream(
      await _sendMultipart(path, token, fields, files, fileField,
          idempotencyKey: idempotencyKey, timeout: timeout),
    );
    if (response.statusCode == 401) {
      final refreshed = await auth.refreshAccessTokenNow();
      if (refreshed == null) {
        throw _authenticationFailure(
          loggedOutMessage: 'Session expired. Please log in again.',
        );
      }
      response = await http.Response.fromStream(
        await _sendMultipart(path, refreshed, fields, files, fileField,
            idempotencyKey: idempotencyKey, timeout: timeout),
      );
    }
    return _decode(response);
  }

  Future<http.StreamedResponse> _sendMultipart(String path, String token,
      Map<String, String> fields, List<PickedUpload> files, String fileField,
      {required String idempotencyKey, Duration? timeout}) {
    final request = http.MultipartRequest('POST', auth.uri(path));
    request.headers['Authorization'] = 'Bearer $token';
    request.headers['Idempotency-Key'] = idempotencyKey;
    request.fields.addAll(fields);
    for (final file in files) {
      request.files.add(http.MultipartFile.fromBytes(
        fileField,
        file.bytes,
        filename: file.name,
        contentType: file.contentType == null
            ? null
            : MediaType.parse(file.contentType!),
      ));
    }
    return _client.send(request).timeout(timeout ?? requestTimeout);
  }

  Stream<String> streamLines(String path,
      {Map<String, String?> query = const {}}) async* {
    final token = await auth.getValidAccessToken();
    if (token == null) {
      throw _authenticationFailure(
        loggedOutMessage: 'Not authenticated. Please log in again.',
      );
    }
    var response = await _sendStreamRequest(path, query, token);
    if (response.statusCode == 401) {
      await response.stream.drain<void>();
      final refreshed = await auth.refreshAccessTokenNow();
      if (refreshed == null) {
        throw _authenticationFailure(
          loggedOutMessage: 'Session expired. Please log in again.',
        );
      }
      response = await _sendStreamRequest(path, query, refreshed);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      await response.stream.drain<void>();
      throw Exception('Stream failed (${response.statusCode})');
    }
    await for (final chunk in response.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter())) {
      if (chunk.trim().isNotEmpty) yield chunk;
    }
  }

  Future<http.StreamedResponse> _sendStreamRequest(
    String path,
    Map<String, String?> query,
    String token,
  ) {
    final request = http.Request('GET', auth.uri(path, query));
    request.headers['Authorization'] = 'Bearer $token';
    return _client.send(request).timeout(requestTimeout);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final body = response.body.trim();
    final decoded =
        body.isEmpty ? <String, dynamic>{} : asMap(jsonDecode(body));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded['error'];
      if (error is Map && error['message'] != null) {
        throw Exception(error['message']);
      }
      if (error != null) throw Exception(error.toString());
      throw Exception('HTTP ${response.statusCode}');
    }
    if (decoded.containsKey('ok') && decoded['ok'] != true) {
      final error = decoded['error'];
      throw Exception(error is Map
          ? (error['message'] ?? error).toString()
          : (error ?? 'Request failed').toString());
    }
    return decoded.containsKey('data') ? asMap(decoded['data']) : decoded;
  }

  static bool _containsHeader(Map<String, String> headers, String name) {
    final normalized = name.toLowerCase();
    return headers.keys.any((key) => key.toLowerCase() == normalized);
  }

  Exception _authenticationFailure({required String loggedOutMessage}) {
    return Exception(auth.isAuthenticated
        ? 'Unable to refresh the session. Check connectivity and retry.'
        : loggedOutMessage);
  }

  void close() => _client.close();
}
