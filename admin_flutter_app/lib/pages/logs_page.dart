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
  final _level = TextEditingController();
  final _service = TextEditingController();
  final _limit = TextEditingController(text: '200');
  final _offset = TextEditingController(text: '0');
  final _since = TextEditingController();
  final List<String> _stream = [];
  StreamSubscription<String>? _subscription;
  String? _streamError;

  @override
  void dispose() {
    _subscription?.cancel();
    _level.dispose();
    _service.dispose();
    _limit.dispose();
    _offset.dispose();
    _since.dispose();
    super.dispose();
  }

  Future<void> _toggleStream() async {
    if (_subscription != null) {
      await _subscription?.cancel();
      setState(() => _subscription = null);
      return;
    }
    setState(() {
      _stream.clear();
      _streamError = null;
    });
    final sub = widget.api.streamLines('/api/v1/admin/logs/stream').listen(
      (line) {
        setState(() {
          _stream.insert(0, line);
          if (_stream.length > 200) _stream.removeLast();
        });
      },
      onError: (Object error) =>
          setState(() => _streamError = error.toString()),
    );
    setState(() => _subscription = sub);
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
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _stream.length,
                    itemBuilder: (context, index) => SelectableText(
                        _stream[index],
                        style: const TextStyle(
                            fontFamily: 'monospace', fontSize: 12)),
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
