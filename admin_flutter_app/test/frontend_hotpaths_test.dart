import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/pages/content_page.dart';
import 'package:noblog_admin_flutter/pages/logs_page.dart';
import 'package:noblog_admin_flutter/theme/admin_theme.dart';

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

http.StreamedResponse _jsonResponse(Object body, int statusCode) {
  return http.StreamedResponse(
    Stream.value(utf8.encode(jsonEncode(body))),
    statusCode,
    headers: const {'Content-Type': 'application/json'},
  );
}

class _LogsClient extends http.BaseClient {
  _LogsClient(this.stream);

  final StreamController<List<int>> stream;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    await request.finalize().drain<void>();
    if (request.url.path == '/api/v1/admin/logs/stream') {
      return http.StreamedResponse(stream.stream, 200);
    }
    if (request.url.path == '/api/v1/admin/logs') {
      return _jsonResponse({
        'ok': true,
        'data': {'items': <Object>[]},
      }, 200);
    }
    return _jsonResponse({'error': 'not found'}, 404);
  }
}

AdminApiClient _api(http.Client client) {
  final auth = AuthStore(client: client)
    ..accessToken = _jwt('access')
    ..refreshToken = _jwt('refresh');
  return AdminApiClient(auth, client: client);
}

Finder _textField(String label) {
  return find.byWidgetPredicate(
    (widget) => widget is TextField && widget.decoration?.labelText == label,
  );
}

Widget _testApp(Widget home) {
  return MaterialApp(theme: AdminTheme.light(), home: home);
}

List<String> _renderedStreamLines(WidgetTester tester) {
  final listView = tester.widget<ListView>(find.byType(ListView));
  final delegate = listView.childrenDelegate as SliverChildBuilderDelegate;
  final context = tester.element(find.byType(ListView));
  return <String>[
    for (var index = 0; index < (delegate.childCount ?? 0); index++)
      (delegate.builder(context, index) as SelectableText).data ?? '',
  ];
}

void main() {
  testWidgets('debounces markdown preview updates for 200 milliseconds',
      (tester) async {
    final stream = StreamController<List<int>>.broadcast();
    final client = _LogsClient(stream);

    await tester.pumpWidget(_testApp(ContentPage(api: _api(client))));

    expect(
        tester.widget<MarkdownBody>(find.byType(MarkdownBody)).data, isEmpty);

    await tester.enterText(_textField('Markdown'), '# Debounced preview');
    await tester.pump(const Duration(milliseconds: 199));
    expect(
        tester.widget<MarkdownBody>(find.byType(MarkdownBody)).data, isEmpty);

    await tester.pump(const Duration(milliseconds: 1));
    expect(
      tester.widget<MarkdownBody>(find.byType(MarkdownBody)).data,
      '# Debounced preview',
    );

    await tester.enterText(_textField('Markdown'), '# Disposed preview');
    await tester.pumpWidget(_testApp(const SizedBox.shrink()));
    await tester.pump(const Duration(milliseconds: 250));
    expect(tester.takeException(), isNull);

    await stream.close();
    client.close();
  });

  testWidgets('batches, parses, and bounds SSE log updates', (tester) async {
    final stream = StreamController<List<int>>.broadcast();
    final client = _LogsClient(stream);

    await tester.pumpWidget(_testApp(LogsPage(api: _api(client))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start stream'));
    await tester.pump();

    stream.add(
        utf8.encode('event: log\nid: event-1\n: keepalive\ndata: first\n'));
    for (var index = 0; index < 205; index++) {
      stream.add(utf8.encode('data: line $index\n'));
    }
    stream.add(utf8.encode('legacy raw line\n'));
    await tester.pump();

    expect(_renderedStreamLines(tester), isEmpty);
    await tester.pump(const Duration(milliseconds: 74));
    expect(_renderedStreamLines(tester), isEmpty);

    await tester.pump(const Duration(milliseconds: 1));
    final lines = _renderedStreamLines(tester);
    expect(lines, hasLength(200));
    expect(lines.first, 'legacy raw line');
    expect(lines[1], 'line 204');
    expect(lines.last, 'line 6');
    expect(lines, isNot(contains('event: log')));
    expect(lines, isNot(contains('id: event-1')));
    expect(lines, isNot(contains(': keepalive')));

    await stream.close();
    await tester.pump();
    expect(find.text('Start stream'), findsOneWidget);
    client.close();
  });

  testWidgets('resets SSE subscription state when the stream errors',
      (tester) async {
    final stream = StreamController<List<int>>.broadcast();
    final client = _LogsClient(stream);

    await tester.pumpWidget(_testApp(LogsPage(api: _api(client))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start stream'));
    await tester.pump();

    stream.addError(StateError('stream failed'));
    await tester.pump();

    expect(find.text('Start stream'), findsOneWidget);
    expect(find.textContaining('stream failed'), findsOneWidget);

    await stream.close();
    client.close();
  });
}
