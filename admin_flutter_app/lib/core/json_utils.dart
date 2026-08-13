import 'dart:convert';

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return <String, dynamic>{'value': value};
}

Map<String, dynamic> parseJsonObject(String text,
    {Map<String, dynamic>? fallback}) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return fallback ?? <String, dynamic>{};
  final decoded = jsonDecode(trimmed);
  if (decoded is Map<String, dynamic>) return decoded;
  if (decoded is Map) {
    return decoded.map((key, value) => MapEntry(key.toString(), value));
  }
  throw const FormatException('JSON object expected');
}

List<dynamic> parseJsonList(String text, {List<dynamic>? fallback}) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return fallback ?? <dynamic>[];
  final decoded = jsonDecode(trimmed);
  if (decoded is List) return decoded;
  throw const FormatException('JSON array expected');
}

String prettyJson(Object? value) {
  const encoder = JsonEncoder.withIndent('  ');
  try {
    return encoder.convert(value);
  } catch (_) {
    return value.toString();
  }
}

String normalizeBaseUrl(String value) {
  final candidate = value.trim();
  final uri = Uri.tryParse(candidate);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    throw const FormatException('API Base URL must be an absolute URL.');
  }

  final scheme = uri.scheme.toLowerCase();
  final host = uri.host.toLowerCase();
  final loopback = host == 'localhost' || host == '127.0.0.1' || host == '::1';
  if (scheme != 'https' && !(scheme == 'http' && loopback)) {
    throw const FormatException(
        'API Base URL must use HTTPS (HTTP is allowed only for loopback).');
  }
  if (uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/')) {
    throw const FormatException(
        'API Base URL cannot include credentials, a path, query, or fragment.');
  }

  return Uri(
    scheme: scheme,
    host: host,
    port: uri.hasPort ? uri.port : null,
  ).toString().replaceFirst(RegExp(r'/$'), '');
}
