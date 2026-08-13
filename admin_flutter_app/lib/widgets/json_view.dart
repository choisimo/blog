import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/json_utils.dart';
import '../theme/admin_theme.dart';

class JsonView extends StatefulWidget {
  const JsonView({
    super.key,
    required this.value,
    this.maxHeight,
    this.maxEagerBytes = 100 * 1024,
  });

  final Object? value;
  final double? maxHeight;
  final int maxEagerBytes;

  @override
  State<JsonView> createState() => _JsonViewState();
}

class _JsonViewState extends State<JsonView> {
  late String _text;
  int? _totalBytes;

  @override
  void initState() {
    super.initState();
    _prepareText();
  }

  @override
  void didUpdateWidget(covariant JsonView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.value, widget.value) ||
        oldWidget.maxEagerBytes != widget.maxEagerBytes) {
      _prepareText();
    }
  }

  void _prepareText() {
    try {
      final compact = jsonEncode(widget.value);
      final encoded = utf8.encode(compact);
      final bytes = encoded.length;
      _totalBytes = bytes > widget.maxEagerBytes ? bytes : null;
      if (_totalBytes == null) {
        _text = prettyJson(widget.value);
        return;
      }

      final previewBytes = encoded.sublist(0, widget.maxEagerBytes);
      _text = '${utf8.decode(previewBytes, allowMalformed: true)}\n\n'
          '… preview limited to ${widget.maxEagerBytes ~/ 1024} KiB';
    } catch (_) {
      _totalBytes = null;
      _text = widget.value.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final box = DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .45),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Padding(
        padding: EdgeInsets.all(tokens.spaceMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_totalBytes case final bytes?) ...[
              Semantics(
                label: 'Large response preview',
                child: Row(
                  children: [
                    Icon(Icons.data_object, size: 18, color: tokens.warning),
                    SizedBox(width: tokens.spaceSm),
                    Expanded(
                      child: Text(
                        'Large response (${(bytes / 1024).toStringAsFixed(1)} KiB). '
                        'Showing a bounded raw preview.',
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: tokens.spaceSm),
            ],
            SelectableText(
              _text,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
    if (widget.maxHeight == null) return box;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: widget.maxHeight!),
      child: SingleChildScrollView(child: box),
    );
  }
}

enum AdminActionKind {
  read,
  mutation,
  destructive,
}

@immutable
class AdminConfirmation {
  const AdminConfirmation({
    required this.title,
    required this.consequence,
    this.confirmLabel = 'Confirm',
  });

  final String title;
  final String consequence;
  final String confirmLabel;
}

class JsonActionCard extends StatefulWidget {
  const JsonActionCard({
    super.key,
    required this.title,
    required this.action,
    required this.actionKind,
    this.actionId,
    this.description,
    this.actionLabel = 'Run',
    this.confirmation,
    this.resultTtl,
    this.autoRun = false,
    this.children = const [],
  })  : assert(
          !autoRun || actionKind == AdminActionKind.read,
          'Only idempotent read actions may auto-run.',
        ),
        assert(
          actionKind != AdminActionKind.destructive || confirmation != null,
          'Destructive actions require explicit confirmation copy.',
        );

  final String title;
  final String? actionId;
  final String? description;
  final String actionLabel;
  final AdminActionKind actionKind;
  final AdminConfirmation? confirmation;
  final Duration? resultTtl;
  final bool autoRun;
  final List<Widget> children;
  final Future<Object?> Function() action;

  @override
  State<JsonActionCard> createState() => _JsonActionCardState();
}

class _JsonActionCardState extends State<JsonActionCard> {
  _ActionPhase _phase = _ActionPhase.idle;
  Object? _result;
  String? _error;
  int _operationId = 0;
  Timer? _resultTimer;

  bool get _loading => _phase == _ActionPhase.loading;

  @override
  void initState() {
    super.initState();
    if (widget.autoRun) Future<void>.microtask(_run);
  }

  @override
  void dispose() {
    _resultTimer?.cancel();
    super.dispose();
  }

  Future<bool> _confirmIfNeeded() async {
    final confirmation = widget.confirmation;
    if (widget.actionKind != AdminActionKind.destructive) {
      return true;
    }
    // Assertions catch configuration errors in development; this guard keeps
    // the destructive path fail-closed in release builds as well.
    if (confirmation == null) return false;

    final tokens = AdminThemeTokens.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(Icons.warning_amber_rounded, color: tokens.danger),
        title: Text(confirmation.title),
        content: Text(confirmation.consequence),
        actions: [
          TextButton(
            autofocus: true,
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: tokens.danger,
              foregroundColor: ThemeData.estimateBrightnessForColor(
                        tokens.danger,
                      ) ==
                      Brightness.dark
                  ? Colors.white
                  : Colors.black,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(confirmation.confirmLabel),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  Future<void> _run() async {
    if (_loading || !await _confirmIfNeeded() || !mounted) return;
    final operationId = ++_operationId;
    _resultTimer?.cancel();
    setState(() {
      _phase = _ActionPhase.loading;
      _error = null;
      _result = null;
    });
    try {
      final result = await widget.action();
      if (!mounted || operationId != _operationId) return;
      setState(() {
        _phase = _ActionPhase.success;
        _result = result;
      });
      final ttl = widget.resultTtl;
      if (ttl != null) {
        _resultTimer = Timer(ttl, () {
          if (!mounted || operationId != _operationId) return;
          _clearResult();
        });
      }
    } catch (error) {
      if (!mounted || operationId != _operationId) return;
      setState(() {
        _phase = _ActionPhase.error;
        _error = error.toString();
      });
    } finally {
      if (mounted &&
          operationId == _operationId &&
          _phase == _ActionPhase.loading) {
        setState(() => _phase = _ActionPhase.idle);
      }
    }
  }

  void _clearResult() {
    _resultTimer?.cancel();
    _resultTimer = null;
    setState(() {
      _phase = _ActionPhase.idle;
      _result = null;
    });
  }

  Widget _actionButton(BuildContext context, {required bool expand}) {
    final tokens = AdminThemeTokens.of(context);
    final icon = switch (widget.actionKind) {
      AdminActionKind.read => Icons.play_arrow_rounded,
      AdminActionKind.mutation => Icons.save_outlined,
      AdminActionKind.destructive => Icons.warning_amber_rounded,
    };
    final semanticsLabel = _loading
        ? '${widget.actionLabel}, in progress'
        : widget.actionKind == AdminActionKind.destructive
            ? '${widget.actionLabel}, requires confirmation'
            : widget.actionLabel;
    final buttonStyle = widget.actionKind == AdminActionKind.destructive
        ? FilledButton.styleFrom(
            backgroundColor: tokens.danger,
            foregroundColor:
                ThemeData.estimateBrightnessForColor(tokens.danger) ==
                        Brightness.dark
                    ? Colors.white
                    : Colors.black,
          )
        : null;

    final button = FilledButton.tonalIcon(
      style: buttonStyle,
      onPressed: _loading ? null : _run,
      icon: _loading
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon, size: 20),
      label: Text(_loading ? 'Working…' : widget.actionLabel),
    );
    return Semantics(
      button: true,
      label: semanticsLabel,
      child: expand ? SizedBox(width: double.infinity, child: button) : button,
    );
  }

  Widget _header(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        if (widget.description != null) ...[
          SizedBox(height: tokens.spaceXs),
          Text(
            widget.description!,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 520) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              text,
              SizedBox(height: tokens.spaceMd),
              _actionButton(context, expand: true),
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: text),
            SizedBox(width: tokens.spaceMd),
            _actionButton(context, expand: false),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    return Semantics(
      container: true,
      label: widget.actionId == null
          ? '${widget.title} action'
          : '${widget.title} action, ${widget.actionId}',
      child: Card(
        child: Padding(
          padding: EdgeInsets.all(tokens.spaceMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _header(context),
              if (widget.children.isNotEmpty) ...[
                SizedBox(height: tokens.spaceMd),
                ...widget.children,
              ],
              if (_loading) ...[
                SizedBox(height: tokens.spaceMd),
                Semantics(
                  liveRegion: true,
                  label: '${widget.title} is running',
                  child: const LinearProgressIndicator(),
                ),
              ],
              if (_phase == _ActionPhase.error && _error != null) ...[
                SizedBox(height: tokens.spaceMd),
                _ActionError(
                  message: _error!,
                  onDismiss: () => setState(() {
                    _phase = _ActionPhase.idle;
                    _error = null;
                  }),
                ),
              ],
              if (_phase == _ActionPhase.success) ...[
                SizedBox(height: tokens.spaceMd),
                Semantics(
                  liveRegion: true,
                  label: '${widget.title} completed successfully',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                        spacing: tokens.spaceMd,
                        runSpacing: tokens.spaceXs,
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle_outline,
                                  color: tokens.success, size: 20),
                              SizedBox(width: tokens.spaceSm),
                              const Text('Request completed'),
                            ],
                          ),
                          TextButton.icon(
                            onPressed: _clearResult,
                            icon: const Icon(Icons.visibility_off_outlined),
                            label: const Text('Clear response'),
                          ),
                        ],
                      ),
                      if (_result != null) ...[
                        SizedBox(height: tokens.spaceSm),
                        JsonView(value: _result, maxHeight: 360),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

enum _ActionPhase { idle, loading, success, error }

class _ActionError extends StatelessWidget {
  const _ActionError({required this.message, required this.onDismiss});

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    return Semantics(
      liveRegion: true,
      label: 'Action failed: $message',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tokens.danger.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(tokens.radiusMd),
          border: Border.all(color: tokens.danger.withValues(alpha: .5)),
        ),
        child: Padding(
          padding: EdgeInsets.all(tokens.spaceMd),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.error_outline, color: tokens.danger),
              SizedBox(width: tokens.spaceSm),
              Expanded(child: SelectableText(message)),
              IconButton(
                tooltip: 'Dismiss error',
                onPressed: onDismiss,
                icon: const Icon(Icons.close),
              ),
            ],
          ),
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
    final tokens = AdminThemeTokens.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.spaceXs,
        tokens.spaceXs,
        tokens.spaceXs,
        tokens.spaceMd,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          if (subtitle != null) ...[
            SizedBox(height: tokens.spaceXs),
            Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}
