import 'package:flutter/material.dart';

import '../theme/admin_theme.dart';

class PageLayout extends StatelessWidget {
  const PageLayout({super.key, required this.children, this.maxWidth});

  final List<Widget> children;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final tokens = AdminThemeTokens.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final horizontalPadding = constraints.maxWidth < tokens.mobileBreakpoint
            ? 12.0
            : tokens.spaceLg;
        return SingleChildScrollView(
          key: const PageStorageKey<String>('page-scroll'),
          padding: EdgeInsets.fromLTRB(
            horizontalPadding,
            tokens.spaceMd,
            horizontalPadding,
            tokens.spaceLg,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: maxWidth ?? tokens.maxContentWidth,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: children,
              ),
            ),
          ),
        );
      },
    );
  }
}
