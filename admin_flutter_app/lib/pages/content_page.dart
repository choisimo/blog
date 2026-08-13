import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../core/api_client.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class ContentPage extends StatefulWidget {
  const ContentPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<ContentPage> createState() => _ContentPageState();
}

class _ContentPageState extends State<ContentPage> {
  static const _previewDebounce = Duration(milliseconds: 200);

  final _key = TextEditingController(text: 'home_ai_cta');
  final _markdown = TextEditingController();
  final _label = TextEditingController();
  final _href = TextEditingController();
  final ValueNotifier<String> _previewMarkdown = ValueNotifier<String>('');
  final ValueNotifier<({String href, String label})> _previewCta =
      ValueNotifier((href: '', label: ''));
  Timer? _previewTimer;
  bool _enabled = true;
  Object? _lastResult;
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _previewTimer?.cancel();
    _previewMarkdown.dispose();
    _previewCta.dispose();
    _key.dispose();
    _markdown.dispose();
    _label.dispose();
    _href.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.get(
          '/api/v1/site-content/admin/${Uri.encodeComponent(_key.text.trim())}');
      if (!mounted) return;
      final block = data['block'];
      if (block is Map) {
        _markdown.text = block['markdown']?.toString() ?? '';
        _label.text = block['ctaLabel']?.toString() ?? '';
        _href.text = block['ctaHref']?.toString() ?? '';
        _enabled = block['enabled'] != false;
        _syncPreviewFromControllers();
      }
      setState(() => _lastResult = data);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scheduleMarkdownPreview(String markdown) {
    _previewTimer?.cancel();
    _previewTimer = Timer(_previewDebounce, () {
      _previewTimer = null;
      if (!mounted || _previewMarkdown.value == markdown) return;
      _previewMarkdown.value = markdown;
    });
  }

  void _updateCtaPreview() {
    final preview = (href: _href.text, label: _label.text);
    if (_previewCta.value != preview) _previewCta.value = preview;
  }

  void _syncPreviewFromControllers() {
    _previewTimer?.cancel();
    _previewTimer = null;
    if (_previewMarkdown.value != _markdown.text) {
      _previewMarkdown.value = _markdown.text;
    }
    _updateCtaPreview();
  }

  Future<void> _save() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.api.put(
          '/api/v1/site-content/admin/${Uri.encodeComponent(_key.text.trim())}',
          body: {
            'markdown': _markdown.text,
            'ctaLabel': _label.text.trim().isEmpty ? null : _label.text.trim(),
            'ctaHref': _href.text.trim().isEmpty ? null : _href.text.trim(),
            'enabled': _enabled,
          });
      if (!mounted) return;
      setState(() => _lastResult = result);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PageLayout(
      children: [
        const SectionTitle('Content Manager',
            subtitle: 'Home AI CTA 같은 site-content block을 수정합니다.'),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Theme.of(context).dividerColor)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ControlGrid(children: [
                    LabeledTextField(label: 'Block key', controller: _key),
                    LabeledTextField(
                        label: 'CTA label',
                        controller: _label,
                        onChanged: (_) => _updateCtaPreview()),
                    LabeledTextField(
                        label: 'CTA href',
                        controller: _href,
                        onChanged: (_) => _updateCtaPreview()),
                  ]),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enabled'),
                    value: _enabled,
                    onChanged: (value) => setState(() => _enabled = value),
                  ),
                  const SizedBox(height: 12),
                  LabeledTextField(
                      label: 'Markdown',
                      controller: _markdown,
                      minLines: 8,
                      maxLines: 18,
                      onChanged: _scheduleMarkdownPreview),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, children: [
                    FilledButton.tonalIcon(
                        onPressed: _loading ? null : _load,
                        icon: const Icon(Icons.refresh),
                        label: Text(_loading ? 'Working...' : 'Load')),
                    FilledButton.icon(
                        onPressed: _loading ? null : _save,
                        icon: const Icon(Icons.save),
                        label: Text(_loading ? 'Working...' : 'Save')),
                  ]),
                  if (_error != null)
                    MaterialBanner(content: SelectableText(_error!), actions: [
                      TextButton(
                          onPressed: () => setState(() => _error = null),
                          child: const Text('Dismiss'))
                    ]),
                ]),
          ),
        ),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Theme.of(context).dividerColor)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Preview',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  DecoratedBox(
                    decoration: BoxDecoration(
                        border:
                            Border.all(color: Theme.of(context).dividerColor),
                        borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: ValueListenableBuilder<String>(
                          valueListenable: _previewMarkdown,
                          builder: (context, markdown, _) =>
                              MarkdownBody(data: markdown),
                        )),
                  ),
                  ValueListenableBuilder<({String href, String label})>(
                    valueListenable: _previewCta,
                    builder: (context, cta, _) {
                      if (cta.label.isEmpty || cta.href.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: FilledButton(
                              onPressed: null, child: Text(cta.label)));
                    },
                  ),
                ]),
          ),
        ),
        if (_lastResult != null) JsonView(value: _lastResult, maxHeight: 360),
      ],
    );
  }
}
