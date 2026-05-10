import 'package:flutter/material.dart';

import '../core/auth_store.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.auth});

  final AuthStore auth;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

enum _LoginStep { loading, gate, setup, login, handoff }

class _LoginPageState extends State<LoginPage> {
  late final TextEditingController _baseUrl =
      TextEditingController(text: widget.auth.baseUrl);
  final TextEditingController _setupToken = TextEditingController();
  final TextEditingController _setupCode = TextEditingController();
  final TextEditingController _totpCode = TextEditingController();
  final TextEditingController _handoff = TextEditingController();
  _LoginStep _step = _LoginStep.loading;
  String? _challengeId;
  Map<String, dynamic>? _setup;
  Object? _status;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_loadStatus);
  }

  @override
  void dispose() {
    _baseUrl.dispose();
    _setupToken.dispose();
    _setupCode.dispose();
    _totpCode.dispose();
    _handoff.dispose();
    super.dispose();
  }

  Future<void> _guard(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _loadStatus() async {
    await _guard(() async {
      await widget.auth.setBaseUrl(_baseUrl.text);
      final status = await widget.auth.getTotpStatus();
      setState(() {
        _status = status;
        _step = status['setupComplete'] == true
            ? _LoginStep.login
            : _LoginStep.gate;
      });
    });
  }

  Future<void> _loadSetup() async {
    await _guard(() async {
      await widget.auth.setBaseUrl(_baseUrl.text);
      final setup =
          await widget.auth.getTotpSetup(setupToken: _setupToken.text.trim());
      setState(() {
        _setup = setup;
        _step = setup['setupComplete'] == true
            ? _LoginStep.login
            : _LoginStep.setup;
      });
    });
  }

  Future<void> _verifySetup() async {
    await _guard(() async {
      await widget.auth.verifyTotpSetup(_setupCode.text.trim(),
          setupToken: _setupToken.text.trim());
      setState(() {
        _step = _LoginStep.login;
        _setupCode.clear();
      });
    });
  }

  Future<void> _requestChallenge() async {
    await _guard(() async {
      final id = await widget.auth.createTotpChallenge();
      setState(() => _challengeId = id);
    });
  }

  Future<void> _verifyLogin() async {
    final id = _challengeId;
    if (id == null) return;
    await _guard(() => widget.auth.verifyTotpCode(id, _totpCode.text.trim()));
  }

  Future<void> _consumeHandoff() async {
    await _guard(() => widget.auth.consumeOAuthHandoff(_handoff.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.admin_panel_settings,
                    size: 52, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 12),
                Text('noblog admin',
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('Flutter 관리자 콘솔',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 24),
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                      side: BorderSide(color: Theme.of(context).dividerColor)),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        LabeledTextField(
                            label: 'API Base URL',
                            controller: _baseUrl,
                            hint: AuthStore.defaultBaseUrl),
                        const SizedBox(height: 12),
                        if (_step == _LoginStep.loading)
                          const Center(child: CircularProgressIndicator()),
                        if (_step == _LoginStep.gate) _gateCard(),
                        if (_step == _LoginStep.setup) _setupCard(),
                        if (_step == _LoginStep.login) _loginCard(),
                        if (_step == _LoginStep.handoff) _handoffCard(),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          MaterialBanner(
                            leading: const Icon(Icons.error_outline),
                            content: SelectableText(_error!),
                            actions: [
                              TextButton(
                                  onPressed: () =>
                                      setState(() => _error = null),
                                  child: const Text('Dismiss'))
                            ],
                          ),
                        ],
                        if (_status != null) ...[
                          const SizedBox(height: 12),
                          JsonView(value: _status, maxHeight: 160),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _busyButton(
      {required String label,
      required VoidCallback onPressed,
      IconData icon = Icons.arrow_forward}) {
    return FilledButton.icon(
      onPressed: _busy ? null : onPressed,
      icon: _busy
          ? const SizedBox.square(
              dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
          : Icon(icon),
      label: Text(_busy ? 'Working...' : label),
    );
  }

  Widget _gateCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Text('First-time setup gate',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Text(
            'TOTP가 아직 설정되지 않은 경우 서버 콘솔 또는 환경 변수의 ADMIN_SETUP_TOKEN을 입력합니다.'),
        const SizedBox(height: 12),
        LabeledTextField(
            label: 'ADMIN_SETUP_TOKEN',
            controller: _setupToken,
            obscureText: true),
        const SizedBox(height: 12),
        _busyButton(
            label: 'Load TOTP setup',
            onPressed: _loadSetup,
            icon: Icons.lock_open),
        TextButton(
            onPressed: _busy ? null : _loadStatus,
            child: const Text('Refresh setup status')),
        TextButton(
            onPressed: () => setState(() => _step = _LoginStep.handoff),
            child: const Text('Use OAuth handoff token')),
      ],
    );
  }

  Widget _setupCard() {
    final qr = _setup?['qrDataUrl']?.toString();
    final secret = _setup?['secret']?.toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Text('Setup authenticator',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (qr != null && qr.startsWith('data:image'))
          Center(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Image.network(qr, width: 190, height: 190),
            ),
          ),
        if (secret != null)
          SelectableText('Manual key: $secret',
              style: const TextStyle(fontFamily: 'monospace')),
        const SizedBox(height: 12),
        LabeledTextField(
            label: '6-digit setup code',
            controller: _setupCode,
            keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        _busyButton(
            label: 'Complete setup',
            onPressed: _verifySetup,
            icon: Icons.verified),
      ],
    );
  }

  Widget _loginCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Text('Authenticator login',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (_challengeId == null)
          _busyButton(
              label: 'Get challenge',
              onPressed: _requestChallenge,
              icon: Icons.key)
        else ...[
          SelectableText('Challenge: $_challengeId',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
          const SizedBox(height: 12),
          LabeledTextField(
              label: '6-digit TOTP code',
              controller: _totpCode,
              keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          _busyButton(
              label: 'Login', onPressed: _verifyLogin, icon: Icons.login),
          TextButton(
              onPressed: _busy ? null : _requestChallenge,
              child: const Text('Request a new challenge')),
        ],
        TextButton(
            onPressed: () => setState(() => _step = _LoginStep.handoff),
            child: const Text('Use OAuth handoff token')),
      ],
    );
  }

  Widget _handoffCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Text('OAuth handoff',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Text('웹 OAuth callback에서 받은 handoff 값을 붙여 넣어 세션을 교환합니다.'),
        const SizedBox(height: 12),
        LabeledTextField(label: 'handoff', controller: _handoff),
        const SizedBox(height: 12),
        _busyButton(
            label: 'Consume handoff',
            onPressed: _consumeHandoff,
            icon: Icons.sync),
        TextButton(
            onPressed: () => setState(() => _step = _LoginStep.login),
            child: const Text('Back to TOTP login')),
      ],
    );
  }
}
