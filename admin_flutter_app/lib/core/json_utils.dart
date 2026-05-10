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
  var result = value.trim();
  while (result.endsWith('/')) {
    result = result.substring(0, result.length - 1);
  }
  return result;
}
