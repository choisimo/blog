import 'package:flutter/material.dart';

import '../core/json_utils.dart';

class JsonView extends StatelessWidget {
  const JsonView({super.key, required this.value, this.maxHeight});

  final Object? value;
  final double? maxHeight;

  @override
  Widget build(BuildContext context) {
    final text = prettyJson(value);
    final box = DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: .45),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: SelectableText(
          text,
          style: const TextStyle(
              fontFamily: 'monospace', fontSize: 12, height: 1.35),
        ),
      ),
    );
    if (maxHeight == null) return SingleChildScrollView(child: box);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight!),
      child: SingleChildScrollView(child: box),
    );
  }
}

class JsonActionCard extends StatefulWidget {
  const JsonActionCard({
    super.key,
    required this.title,
    required this.action,
    this.description,
    this.actionLabel = 'Run',
    this.autoRun = false,
    this.children = const [],
  });

  final String title;
  final String? description;
  final String actionLabel;
  final bool autoRun;
  final List<Widget> children;
  final Future<Object?> Function() action;

  @override
  State<JsonActionCard> createState() => _JsonActionCardState();
}

class _JsonActionCardState extends State<JsonActionCard> {
  bool _loading = false;
  Object? _result;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.autoRun) Future<void>.microtask(_run);
  }

  Future<void> _run() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.action();
      if (!mounted) return;
      setState(() => _result = result);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Theme.of(context).dividerColor)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.title,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      if (widget.description != null) ...[
                        const SizedBox(height: 4),
                        Text(widget.description!,
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
                FilledButton.tonalIcon(
                  onPressed: _loading ? null : _run,
                  icon: _loading
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.play_arrow, size: 18),
                  label: Text(_loading ? 'Running' : widget.actionLabel),
                ),
              ],
            ),
            if (widget.children.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...widget.children,
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              MaterialBanner(
                content: SelectableText(_error!),
                leading: const Icon(Icons.error_outline),
                actions: [
                  TextButton(
                      onPressed: () => setState(() => _error = null),
                      child: const Text('Dismiss'))
                ],
              ),
            ],
            if (_result != null) ...[
              const SizedBox(height: 12),
              JsonView(value: _result, maxHeight: 360),
            ],
          ],
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800)),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}
