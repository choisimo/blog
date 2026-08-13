import 'package:flutter/material.dart';

@immutable
class AdminThemeTokens extends ThemeExtension<AdminThemeTokens> {
  const AdminThemeTokens({
    required this.mobileBreakpoint,
    required this.desktopBreakpoint,
    required this.maxContentWidth,
    required this.minControlWidth,
    required this.spaceXs,
    required this.spaceSm,
    required this.spaceMd,
    required this.spaceLg,
    required this.radiusSm,
    required this.radiusMd,
    required this.radiusLg,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    required this.fastDuration,
    required this.standardDuration,
    required this.emphasizedCurve,
  });

  final double mobileBreakpoint;
  final double desktopBreakpoint;
  final double maxContentWidth;
  final double minControlWidth;
  final double spaceXs;
  final double spaceSm;
  final double spaceMd;
  final double spaceLg;
  final double radiusSm;
  final double radiusMd;
  final double radiusLg;
  final Color success;
  final Color warning;
  final Color danger;
  final Color info;
  final Duration fastDuration;
  final Duration standardDuration;
  final Curve emphasizedCurve;

  static AdminThemeTokens of(BuildContext context) {
    final tokens = Theme.of(context).extension<AdminThemeTokens>();
    assert(tokens != null, 'AdminThemeTokens must be installed in ThemeData.');
    return tokens!;
  }

  static const light = AdminThemeTokens(
    mobileBreakpoint: 600,
    desktopBreakpoint: 960,
    maxContentWidth: 1320,
    minControlWidth: 280,
    spaceXs: 4,
    spaceSm: 8,
    spaceMd: 16,
    spaceLg: 24,
    radiusSm: 8,
    radiusMd: 12,
    radiusLg: 16,
    success: Color(0xFF147D64),
    warning: Color(0xFF9A5B00),
    danger: Color(0xFFBA1A1A),
    info: Color(0xFF315DA8),
    fastDuration: Duration(milliseconds: 120),
    standardDuration: Duration(milliseconds: 200),
    emphasizedCurve: Curves.easeOutCubic,
  );

  static const dark = AdminThemeTokens(
    mobileBreakpoint: 600,
    desktopBreakpoint: 960,
    maxContentWidth: 1320,
    minControlWidth: 280,
    spaceXs: 4,
    spaceSm: 8,
    spaceMd: 16,
    spaceLg: 24,
    radiusSm: 8,
    radiusMd: 12,
    radiusLg: 16,
    success: Color(0xFF6DDBBC),
    warning: Color(0xFFFFB95C),
    danger: Color(0xFFFFB4AB),
    info: Color(0xFFA9C7FF),
    fastDuration: Duration(milliseconds: 120),
    standardDuration: Duration(milliseconds: 200),
    emphasizedCurve: Curves.easeOutCubic,
  );

  @override
  AdminThemeTokens copyWith({
    double? mobileBreakpoint,
    double? desktopBreakpoint,
    double? maxContentWidth,
    double? minControlWidth,
    double? spaceXs,
    double? spaceSm,
    double? spaceMd,
    double? spaceLg,
    double? radiusSm,
    double? radiusMd,
    double? radiusLg,
    Color? success,
    Color? warning,
    Color? danger,
    Color? info,
    Duration? fastDuration,
    Duration? standardDuration,
    Curve? emphasizedCurve,
  }) {
    return AdminThemeTokens(
      mobileBreakpoint: mobileBreakpoint ?? this.mobileBreakpoint,
      desktopBreakpoint: desktopBreakpoint ?? this.desktopBreakpoint,
      maxContentWidth: maxContentWidth ?? this.maxContentWidth,
      minControlWidth: minControlWidth ?? this.minControlWidth,
      spaceXs: spaceXs ?? this.spaceXs,
      spaceSm: spaceSm ?? this.spaceSm,
      spaceMd: spaceMd ?? this.spaceMd,
      spaceLg: spaceLg ?? this.spaceLg,
      radiusSm: radiusSm ?? this.radiusSm,
      radiusMd: radiusMd ?? this.radiusMd,
      radiusLg: radiusLg ?? this.radiusLg,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      info: info ?? this.info,
      fastDuration: fastDuration ?? this.fastDuration,
      standardDuration: standardDuration ?? this.standardDuration,
      emphasizedCurve: emphasizedCurve ?? this.emphasizedCurve,
    );
  }

  @override
  AdminThemeTokens lerp(AdminThemeTokens? other, double t) {
    if (other == null) return this;
    return AdminThemeTokens(
      mobileBreakpoint: lerpDouble(mobileBreakpoint, other.mobileBreakpoint, t),
      desktopBreakpoint:
          lerpDouble(desktopBreakpoint, other.desktopBreakpoint, t),
      maxContentWidth: lerpDouble(maxContentWidth, other.maxContentWidth, t),
      minControlWidth: lerpDouble(minControlWidth, other.minControlWidth, t),
      spaceXs: lerpDouble(spaceXs, other.spaceXs, t),
      spaceSm: lerpDouble(spaceSm, other.spaceSm, t),
      spaceMd: lerpDouble(spaceMd, other.spaceMd, t),
      spaceLg: lerpDouble(spaceLg, other.spaceLg, t),
      radiusSm: lerpDouble(radiusSm, other.radiusSm, t),
      radiusMd: lerpDouble(radiusMd, other.radiusMd, t),
      radiusLg: lerpDouble(radiusLg, other.radiusLg, t),
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      info: Color.lerp(info, other.info, t)!,
      fastDuration: _lerpDuration(fastDuration, other.fastDuration, t),
      standardDuration:
          _lerpDuration(standardDuration, other.standardDuration, t),
      emphasizedCurve: t < .5 ? emphasizedCurve : other.emphasizedCurve,
    );
  }

  static double lerpDouble(double a, double b, double t) => a + (b - a) * t;

  static Duration _lerpDuration(Duration a, Duration b, double t) {
    return Duration(
      microseconds: lerpDouble(
        a.inMicroseconds.toDouble(),
        b.inMicroseconds.toDouble(),
        t,
      ).round(),
    );
  }
}

abstract final class AdminTheme {
  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF3858D6),
      brightness: brightness,
      dynamicSchemeVariant: DynamicSchemeVariant.fidelity,
    );
    final tokens = dark ? AdminThemeTokens.dark : AdminThemeTokens.light;
    final outline = scheme.outlineVariant.withValues(alpha: dark ? .72 : .9);

    final base = ThemeData(
      brightness: brightness,
      colorScheme: scheme,
      useMaterial3: true,
      visualDensity: VisualDensity.standard,
      extensions: [tokens],
    );

    return base.copyWith(
      scaffoldBackgroundColor:
          dark ? const Color(0xFF111318) : const Color(0xFFF7F8FC),
      focusColor: scheme.primary.withValues(alpha: .16),
      cardTheme: CardThemeData(
        elevation: 0,
        color: dark ? const Color(0xFF1A1D24) : scheme.surface,
        margin: EdgeInsets.only(bottom: tokens.spaceMd),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radiusLg),
          side: BorderSide(color: outline),
        ),
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 1,
        backgroundColor: dark
            ? const Color(0xFF171A20)
            : scheme.surface.withValues(alpha: .96),
        surfaceTintColor: Colors.transparent,
      ),
      dividerTheme: DividerThemeData(color: outline, space: 1),
      inputDecorationTheme: InputDecorationThemeData(
        filled: true,
        fillColor: scheme.surfaceContainerLowest,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(tokens.radiusMd),
          borderSide: BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(tokens.radiusMd),
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(tokens.radiusMd),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(tokens.radiusMd),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(tokens.radiusMd),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor:
            dark ? const Color(0xFF171A20) : scheme.surfaceContainerLow,
        indicatorColor: scheme.secondaryContainer,
        minWidth: 88,
        minExtendedWidth: 220,
        labelType: NavigationRailLabelType.all,
      ),
      drawerTheme: DrawerThemeData(
        backgroundColor:
            dark ? const Color(0xFF171A20) : scheme.surfaceContainerLow,
        shape: const RoundedRectangleBorder(),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHighest,
      ),
      tooltipTheme: TooltipThemeData(
        waitDuration: const Duration(milliseconds: 500),
        decoration: BoxDecoration(
          color: scheme.inverseSurface,
          borderRadius: BorderRadius.circular(tokens.radiusSm),
        ),
        textStyle: TextStyle(color: scheme.onInverseSurface),
      ),
    );
  }
}
