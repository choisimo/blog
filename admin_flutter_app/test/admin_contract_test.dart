import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/pages/config_page.dart';
import 'package:noblog_admin_flutter/pages/login_page.dart';
import 'package:noblog_admin_flutter/pages/secrets_page.dart';
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

Widget _app(Widget home) => MaterialApp(
      theme: AdminTheme.light(),
      home: Scaffold(body: home),
    );

Finder _field(String label) {
  return find.byWidgetPredicate(
    (widget) => widget is TextField && widget.decoration?.labelText == label,
  );
}

AdminApiClient _api(http.Client client) {
  final auth = AuthStore(client: client)
    ..accessToken = _jwt('access')
    ..refreshToken = _jwt('refresh')
    ..user = {'role': 'admin'};
  return AdminApiClient(auth, client: client);
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('TOTP setup renders the Worker otpauthUri contract',
      (tester) async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/totp/status') {
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {'setupComplete': false, 'requiresSetupToken': true},
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/auth/totp/setup') {
        expect(request.headers['Setup-Token'], 'setup-token');
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {
              'setupComplete': false,
              'secret': 'JBSWY3DPEHPK3PXP',
              'otpauthUri':
                  'otpauth://totp/noblog:admin?secret=JBSWY3DPEHPK3PXP',
            },
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });
    final auth = AuthStore(client: client);

    await tester.pumpWidget(_app(LoginPage(auth: auth)));
    await tester.pumpAndSettle();
    await tester.enterText(_field('ADMIN_SETUP_TOKEN'), 'setup-token');
    await tester.tap(find.text('Load TOTP setup'));
    await tester.pumpAndSettle();

    expect(find.text('Open authenticator app'), findsOneWidget);
    expect(find.textContaining('Manual key: JBSWY3DPEHPK3PXP'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('secret reveal sends the required break-glass reason',
      (tester) async {
    Map<String, dynamic>? revealBody;
    final client = MockClient((request) async {
      if (request.method == 'POST' && request.url.path.endsWith('/reveal')) {
        revealBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {'value': 'plaintext-secret'},
          }),
          200,
        );
      }
      return http.Response(jsonEncode({'ok': true, 'data': {}}), 200);
    });

    await tester.pumpWidget(_app(SecretsPage(api: _api(client))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Secrets'));
    await tester.pumpAndSettle();
    await tester.enterText(_field('Secret ID').first, 'secret-id');
    await tester.enterText(
        _field('Break-glass reason'), 'incident response 42');
    await tester.ensureVisible(find.text('Reveal'));
    await tester.tap(find.text('Reveal'));
    await tester.pumpAndSettle();
    expect(revealBody, isNull);
    await tester.tap(find.text('Reveal value'));
    await tester.pumpAndSettle();

    expect(revealBody, {'reason': 'incident response 42'});
    expect(find.textContaining('plaintext-secret'), findsOneWidget);
    await tester.pump(const Duration(seconds: 30));
    expect(find.textContaining('plaintext-secret'), findsNothing);
  });

  testWidgets('plaintext secret export sends break-glass reason in a header',
      (tester) async {
    http.Request? exportRequest;
    final client = MockClient((request) async {
      if (request.method == 'GET' && request.url.path.endsWith('/export')) {
        exportRequest = request;
        return http.Response(
          jsonEncode({
            'ok': true,
            'data': {'secrets': <Object>[]},
          }),
          200,
        );
      }
      return http.Response(jsonEncode({'ok': true, 'data': {}}), 200);
    });

    await tester.pumpWidget(_app(SecretsPage(api: _api(client))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Import/Export'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('includeValues'));
    await tester.pump();
    await tester.enterText(
        _field('Break-glass reason'), 'security incident export');
    await tester.ensureVisible(find.text('Export'));
    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.text('Export secrets'),
    ));
    await tester.pumpAndSettle();

    expect(exportRequest, isNotNull);
    expect(exportRequest!.url.queryParameters['includeValues'], 'true');
    expect(exportRequest!.headers['X-Break-Glass-Reason'],
        'security incident export');
  });

  testWidgets('config editor defaults match backend request contracts',
      (tester) async {
    var saveRequests = 0;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/save-env')) saveRequests += 1;
      return http.Response(jsonEncode({'ok': true, 'data': {}}), 200);
    });

    await tester.pumpWidget(_app(ConfigPage(api: _api(client))));
    await tester.pumpAndSettle();

    final validation = tester.widget<TextField>(_field('Validation JSON'));
    final save = tester.widget<TextField>(_field('Save JSON'));
    expect(jsonDecode(validation.controller!.text), {
      'key': 'SITE_BASE_URL',
      'value': '',
    });
    expect(jsonDecode(save.controller!.text), {
      'variables': {'KEY': 'value'},
      'target': 'backend',
    });

    await tester.ensureVisible(find.text('Save .env'));
    await tester.tap(find.text('Save .env'));
    await tester.pumpAndSettle();
    expect(saveRequests, 0);
    expect(find.text('Overwrite the environment file?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(saveRequests, 0);
  });
}
