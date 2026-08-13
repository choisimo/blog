import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:noblog_admin_flutter/core/api_client.dart';
import 'package:noblog_admin_flutter/core/auth_store.dart';
import 'package:noblog_admin_flutter/pages/dashboard_page.dart';
import 'package:noblog_admin_flutter/theme/admin_theme.dart';
import 'package:noblog_admin_flutter/widgets/form_widgets.dart';
import 'package:noblog_admin_flutter/widgets/json_view.dart';

Widget _app(Widget home, {double textScale = 1}) {
  return MaterialApp(
    theme: AdminTheme.light(),
    home: MediaQuery(
      data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
      child: home,
    ),
  );
}

class _DraftPage extends StatefulWidget {
  const _DraftPage({required this.label, required this.onMount});

  final String label;
  final VoidCallback onMount;

  @override
  State<_DraftPage> createState() => _DraftPageState();
}

class _DraftPageState extends State<_DraftPage> {
  final controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    widget.onMount();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextField(
        key: ValueKey('draft-${widget.label}'),
        controller: controller,
        decoration: InputDecoration(labelText: '${widget.label} draft'),
      ),
    );
  }
}

void main() {
  testWidgets(
      'lazy dashboard preserves draft state and does not remount across navigation or breakpoint changes',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1200, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var firstMounts = 0;
    var secondMounts = 0;
    final auth = AuthStore()
      ..accessToken = 'access'
      ..refreshToken = 'refresh'
      ..user = {'email': 'long.admin.identity@example.com'};
    final api = AdminApiClient(auth);
    final destinations = [
      AdminDestination(
        id: AdminTab.health,
        pathSegment: 'first',
        label: 'First',
        icon: Icons.looks_one_outlined,
        pageBuilder: (_, __) =>
            _DraftPage(label: 'first', onMount: () => firstMounts += 1),
      ),
      AdminDestination(
        id: AdminTab.rag,
        pathSegment: 'second',
        label: 'Second',
        icon: Icons.looks_two_outlined,
        pageBuilder: (_, __) =>
            _DraftPage(label: 'second', onMount: () => secondMounts += 1),
      ),
    ];

    await tester.pumpWidget(_app(DashboardPage(
      auth: auth,
      api: api,
      destinations: destinations,
    )));
    await tester.enterText(
        find.byKey(const ValueKey('draft-first')), 'preserved draft');

    expect(firstMounts, 1);
    expect(secondMounts, 0);
    await tester.tap(find.text('Second'));
    await tester.pump();
    expect(secondMounts, 1);
    await tester.tap(find.text('First'));
    await tester.pump();
    expect(
      tester
          .widget<TextField>(find.byKey(const ValueKey('draft-first')))
          .controller
          ?.text,
      'preserved draft',
    );

    await tester.binding.setSurfaceSize(const Size(959, 800));
    await tester.pump();
    expect(find.byType(NavigationRail), findsNothing);
    await tester.binding.setSurfaceSize(const Size(960, 800));
    await tester.pump();
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(firstMounts, 1);
    expect(secondMounts, 1);
    expect(
      tester
          .widget<TextField>(find.byKey(const ValueKey('draft-first')))
          .controller
          ?.text,
      'preserved draft',
    );
  });

  testWidgets('control grid honors 599/600 boundary with intrinsic heights',
      (tester) async {
    Future<void> pumpAt(double width, {double textScale = 1}) async {
      await tester.binding.setSurfaceSize(Size(width, 700));
      await tester.pumpWidget(_app(
        const Scaffold(
          body: ControlGrid(
            children: [
              SizedBox(key: ValueKey('control-a'), height: 80),
              SizedBox(key: ValueKey('control-b'), height: 160),
            ],
          ),
        ),
        textScale: textScale,
      ));
    }

    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpAt(599);
    expect(tester.getSize(find.byKey(const ValueKey('control-a'))).width, 599);
    expect(tester.getTopLeft(find.byKey(const ValueKey('control-b'))).dy, 96);

    await pumpAt(600);
    expect(tester.getSize(find.byKey(const ValueKey('control-a'))).width, 292);
    expect(tester.getTopLeft(find.byKey(const ValueKey('control-b'))).dy, 0);

    await pumpAt(320, textScale: 2);
    expect(tester.getSize(find.byKey(const ValueKey('control-b'))).width, 320);
    expect(tester.takeException(), isNull);
  });

  testWidgets('admin shell remains usable at 320 pixels and 200 percent text',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final auth = AuthStore()
      ..accessToken = 'access'
      ..refreshToken = 'refresh'
      ..user = {'email': 'very.long.operations.identity@example.com'};
    final api = AdminApiClient(auth);
    final destinations = [
      AdminDestination(
        id: AdminTab.health,
        pathSegment: 'narrow',
        label: 'Narrow destination with a long label',
        icon: Icons.monitor_heart_outlined,
        pageBuilder: (_, __) => JsonActionCard(
          title: 'A long administrative operation title',
          description: 'Controls and actions must wrap without clipping.',
          actionLabel: 'Refresh operation',
          actionKind: AdminActionKind.read,
          action: () async => {'status': 'healthy'},
        ),
      ),
    ];

    await tester.pumpWidget(_app(
      DashboardPage(auth: auth, api: api, destinations: destinations),
      textScale: 2,
    ));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byTooltip('Log out')).shortestSide,
        greaterThanOrEqualTo(48));
    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Narrow destination with a long label'), findsWidgets);
  });

  testWidgets('destructive action requires confirmation before execution',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(_app(Scaffold(
      body: JsonActionCard(
        title: 'Delete production secret',
        actionId: 'test.delete-secret',
        actionLabel: 'Delete',
        actionKind: AdminActionKind.destructive,
        confirmation: const AdminConfirmation(
          title: 'Delete the secret?',
          consequence: 'The dependent service may stop working.',
          confirmLabel: 'Delete secret',
        ),
        action: () async {
          calls += 1;
          return {'deleted': true};
        },
      ),
    )));

    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(find.text('Delete the secret?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(calls, 0);

    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete secret'));
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.textContaining('"deleted": true'), findsOneWidget);
  });

  testWidgets('action rerun clears stale success before reporting an error',
      (tester) async {
    var invocation = 0;
    final secondResult = Completer<Object?>();
    await tester.pumpWidget(_app(Scaffold(
      body: JsonActionCard(
        title: 'Refresh data',
        actionLabel: 'Refresh',
        actionKind: AdminActionKind.read,
        action: () {
          invocation += 1;
          if (invocation == 1) return Future.value({'version': 'old'});
          return secondResult.future;
        },
      ),
    )));

    await tester.tap(find.text('Refresh'));
    await tester.pumpAndSettle();
    expect(find.textContaining('"version": "old"'), findsOneWidget);

    await tester.tap(find.text('Refresh'));
    await tester.pump();
    expect(find.textContaining('"version": "old"'), findsNothing);
    secondResult.completeError(StateError('upstream unavailable'));
    await tester.pumpAndSettle();
    expect(find.textContaining('upstream unavailable'), findsOneWidget);
    expect(find.textContaining('"version": "old"'), findsNothing);
  });

  test('auto-run is rejected for non-read actions', () {
    expect(
      () => JsonActionCard(
        title: 'Invalid auto mutation',
        actionKind: AdminActionKind.mutation,
        autoRun: true,
        action: () async => null,
      ),
      throwsAssertionError,
    );
  });
}
