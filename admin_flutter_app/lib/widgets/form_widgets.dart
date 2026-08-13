import 'package:flutter/material.dart';

import '../theme/admin_theme.dart';

class LabeledTextField extends StatelessWidget {
  const LabeledTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.minLines = 1,
    this.maxLines = 1,
    this.keyboardType,
    this.obscureText = false,
    this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final int minLines;
  final int maxLines;
  final TextInputType? keyboardType;
  final bool obscureText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      minLines: obscureText ? 1 : minLines,
      maxLines: obscureText ? 1 : maxLines,
      keyboardType: keyboardType,
      obscureText: obscureText,
      onChanged: onChanged,
      decoration: InputDecoration(labelText: label, hintText: hint),
    );
  }
}

class JsonTextField extends StatelessWidget {
  const JsonTextField(
      {super.key, required this.label, required this.controller, this.example});

  final String label;
  final TextEditingController controller;
  final String? example;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      minLines: 5,
      maxLines: 14,
      style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
      decoration: InputDecoration(
        labelText: label,
        alignLabelWithHint: true,
        hintText: example,
      ),
    );
  }
}

class ControlGrid extends StatelessWidget {
  const ControlGrid({
    super.key,
    required this.children,
    this.minItemWidth,
    this.maxColumns = 3,
  });

  final List<Widget> children;
  final double? minItemWidth;
  final int maxColumns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (children.isEmpty) return const SizedBox.shrink();
        final tokens = AdminThemeTokens.of(context);
        final gap = tokens.spaceMd;
        final minimum = minItemWidth ?? tokens.minControlWidth;
        final available = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : minimum * maxColumns + gap * (maxColumns - 1);
        final fittedColumns = available < tokens.mobileBreakpoint
            ? 1
            : ((available + gap) / (minimum + gap)).floor();
        final columns = fittedColumns.clamp(1, maxColumns);
        final itemWidth = (available - gap * (columns - 1)) / columns;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}
