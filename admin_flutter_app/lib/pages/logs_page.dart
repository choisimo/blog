import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class LogsPage extends StatefulWidget {
  const LogsPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<LogsPage> createState() => _LogsPageState();
}

class _LogsPageState extends State<LogsPage> {
  static const _maxStreamLines = 200;
  static const _streamFlushInterval = Duration(milliseconds: 75);

  final _level = TextEditingController();
  final _service = TextEditingController();
  final _limit = TextEditingController(text: '200');
  final _offset = TextEditingController(text: '0');
  final _since = TextEditingController();
  final ValueNotifier<List<String>> _streamLines =
      ValueNotifier<List<String>>(const []);
  final List<String> _pendingStreamLines = [];
  StreamSubscription<String>? _subscription;
  Timer? _streamFlushTimer;
  String? _streamError;

  @override
  void dispose() {
    _streamFlushTimer?.cancel();
    unawaited(_subscription?.cancel());
    _streamLines.dispose();
    _level.dispose();
    _service.dispose();
    _limit.dispose();
    _offset.dispose();
    _since.dispose();
    super.dispose();
  }

  Future<void> _toggleStream() async {
    final activeSubscription = _subscription;
    if (activeSubscription != null) {
      if (mounted) setState(() => _subscription = null);
      await activeSubscription.cancel();
      return;
    }
    if (!mounted) return;

    _streamFlushTimer?.cancel();
    _streamFlushTimer = null;
    _pendingStreamLines.clear();
    _streamLines.value = const [];
    setState(() {
      _streamError = null;
    });
    final sub = widget.api.streamLines('/api/v1/admin/logs/stream').listen(
      (line) {
        final parsed = _parseStreamLine(line);
        if (!mounted || parsed == null) return;
        _pendingStreamLines.add(parsed);
        if (_pendingStreamLines.length > _maxStreamLines) {
          _pendingStreamLines.removeRange(
              0, _pendingStreamLines.length - _maxStreamLines);
        }
        _streamFlushTimer ??=
            Timer(_streamFlushInterval, _flushPendingStreamLines);
      },
      onError: (Object error) {
        if (!mounted) return;
        setState(() {
          _subscription = null;
          _streamError = error.toString();
        });
      },
      onDone: () {
        if (mounted) setState(() => _subscription = null);
      },
      cancelOnError: true,
    );
    if (mounted) setState(() => _subscription = sub);
  }

  String? _parseStreamLine(String line) {
    final normalized = line.trimRight();
    final fieldLine = normalized.trimLeft();
    if (fieldLine.isEmpty || fieldLine.startsWith(':')) return null;

    final separator = fieldLine.indexOf(':');
    if (separator < 0) return normalized;

    final field = fieldLine.substring(0, separator);
    var value = fieldLine.substring(separator + 1);
    if (value.startsWith(' ')) value = value.substring(1);
    return switch (field) {
      'data' => value.isEmpty ? null : value,
      'event' || 'id' || 'retry' => null,
      _ => normalized,
    };
  }

  void _flushPendingStreamLines() {
    _streamFlushTimer = null;
    if (!mounted || _pendingStreamLines.isEmpty) return;

    final lines = <String>[
      ..._pendingStreamLines.reversed,
      ..._streamLines.value,
    ];
    _pendingStreamLines.clear();
    if (lines.length > _maxStreamLines) {
      lines.removeRange(_maxStreamLines, lines.length);
    }
    _streamLines.value = List<String>.unmodifiable(lines);
  }

  @override
  Widget build(BuildContext context) {
    return PageLayout(
      children: [
        const SectionTitle('Logs',
            subtitle: 'Postgres에 저장된 로그와 서버 SSE 로그 스트림을 확인합니다.'),
        JsonActionCard(
          title: 'Load logs',
          description: 'GET /api/v1/admin/logs',
          actionKind: AdminActionKind.read,
          autoRun: true,
          actionLabel: 'Load logs',
          children: [
            ControlGrid(children: [
              LabeledTextField(
                  label: 'level',
                  controller: _level,
                  hint: 'info | warn | error'),
              LabeledTextField(label: 'service', controller: _service),
              LabeledTextField(
                  label: 'limit',
                  controller: _limit,
                  keyboardType: TextInputType.number),
              LabeledTextField(
                  label: 'offset',
                  controller: _offset,
                  keyboardType: TextInputType.number),
              LabeledTextField(
                  label: 'since', controller: _since, hint: 'ISO timestamp'),
            ])
          ],
          action: () => widget.api.get('/api/v1/admin/logs', query: {
            'level': _level.text,
            'service': _service.text,
            'limit': _limit.text,
            'offset': _offset.text,
            'since': _since.text,
          }),
        ),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Theme.of(context).dividerColor)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('SSE log stream',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                FilledButton.tonalIcon(
                  onPressed: _toggleStream,
                  icon: Icon(
                      _subscription == null ? Icons.play_arrow : Icons.stop),
                  label: Text(
                      _subscription == null ? 'Start stream' : 'Stop stream'),
                ),
              ]),
              const SizedBox(height: 8),
              const Text('GET /api/v1/admin/logs/stream'),
              if (_streamError != null)
                MaterialBanner(
                    content: SelectableText(_streamError!),
                    actions: [
                      TextButton(
                          onPressed: () => setState(() => _streamError = null),
                          child: const Text('Dismiss'))
                    ]),
              const SizedBox(height: 12),
              SizedBox(
                height: 420,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                      border: Border.all(color: Theme.of(context).dividerColor),
                      borderRadius: BorderRadius.circular(12)),
                  child: ValueListenableBuilder<List<String>>(
                    valueListenable: _streamLines,
                    builder: (context, lines, _) => ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: lines.length,
                      itemBuilder: (context, index) => SelectableText(
                          lines[index],
                          style: const TextStyle(
                              fontFamily: 'monospace', fontSize: 12)),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}
