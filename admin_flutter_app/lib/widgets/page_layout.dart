import 'package:flutter/material.dart';

class PageLayout extends StatelessWidget {
  const PageLayout({super.key, required this.children, this.maxWidth = 1320});

  final List<Widget> children;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children),
        ),
      ),
    );
  }
}
