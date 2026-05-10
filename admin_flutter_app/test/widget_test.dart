import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/main.dart';

void main() {
  testWidgets('shows loading state before auth initialization', (tester) async {
    final auth = AuthStore();
    final api = AdminApiClient(auth);

    await tester.pumpWidget(AdminApp(auth: auth, api: api));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
