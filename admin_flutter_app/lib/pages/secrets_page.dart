import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class SecretsPage extends StatefulWidget {
  const SecretsPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<SecretsPage> createState() => _SecretsPageState();
}

class _SecretsPageState extends State<SecretsPage> {
  final _categoryId = TextEditingController();
  final _categoryBody = TextEditingController(
      text:
          '{"name":"custom","displayName":"Custom","description":"Custom secrets","icon":"key"}');
  final _secretId = TextEditingController();
  final _secretBody = TextEditingController(text: '''{
  "categoryId": "cat_ai",
  "keyName": "EXAMPLE_API_KEY",
  "displayName": "Example API Key",
  "description": "Example secret",
  "value": "replace-me",
  "isRequired": false
}''');
  final _generateBody =
      TextEditingController(text: '{"type":"secret","length":32,"prefix":""}');
  final _auditQuery =
      TextEditingController(text: '{"limit":"50","offset":"0"}');
  final _importBody =
      TextEditingController(text: '{"secrets":[],"overwrite":false}');
  final _breakGlassReason = TextEditingController();
  bool _includeValues = false;

  @override
  void dispose() {
    for (final c in [
      _categoryId,
      _categoryBody,
      _secretId,
      _secretBody,
      _generateBody,
      _auditQuery,
      _importBody,
      _breakGlassReason,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Column(
        children: [
          const Material(
              child: TabBar(isScrollable: true, tabs: [
            Tab(text: 'Overview'),
            Tab(text: 'Secrets'),
            Tab(text: 'Categories'),
            Tab(text: 'Audit'),
            Tab(text: 'Import/Export')
          ])),
          Expanded(
            child: TabBarView(children: [
              _overview(),
              _secrets(),
              _categories(),
              _audit(),
              _importExport()
            ]),
          ),
        ],
      ),
    );
  }

  Widget _overview() => PageLayout(children: [
        const SectionTitle('Secrets Overview',
            subtitle: 'secrets health와 overview를 확인합니다.'),
        JsonActionCard(
            title: 'Overview',
            actionKind: AdminActionKind.read,
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/secrets/overview')),
        JsonActionCard(
            title: 'Health',
            actionKind: AdminActionKind.read,
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/secrets/health')),
      ]);

  Widget _secrets() => PageLayout(children: [
        const SectionTitle('Secrets',
            subtitle: 'secret 목록, 생성, 수정, 삭제, reveal, generate'),
        JsonActionCard(
            title: 'List secrets',
            actionKind: AdminActionKind.read,
            autoRun: true,
            children: [
              ControlGrid(children: [
                LabeledTextField(
                    label: 'categoryId filter', controller: _categoryId)
              ])
            ],
            action: () => widget.api.get('/api/v1/admin/secrets',
                query: {'categoryId': _categoryId.text})),
        JsonActionCard(
            title: 'Get secret',
            actionKind: AdminActionKind.read,
            actionLabel: 'Get',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Secret ID', controller: _secretId)
              ])
            ],
            action: () => widget.api.get(
                '/api/v1/admin/secrets/${Uri.encodeComponent(_secretId.text.trim())}')),
        JsonActionCard(
            title: 'Create secret',
            actionKind: AdminActionKind.destructive,
            actionId: 'secrets.create-secret',
            actionLabel: 'Create',
            confirmation: const AdminConfirmation(
              title: 'Create secret?',
              consequence:
                  'This writes a new credential or sensitive value to the secret store.',
              confirmLabel: 'Create secret',
            ),
            children: [
              JsonTextField(label: 'Secret JSON', controller: _secretBody)
            ],
            action: () => widget.api.post('/api/v1/admin/secrets',
                body: parseJsonObject(_secretBody.text))),
        JsonActionCard(
            title: 'Update secret',
            actionKind: AdminActionKind.destructive,
            actionId: 'secrets.update-secret',
            actionLabel: 'Update',
            confirmation: const AdminConfirmation(
              title: 'Update secret?',
              consequence:
                  'This replaces stored secret metadata or value and may affect dependent services.',
              confirmLabel: 'Update secret',
            ),
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Secret ID', controller: _secretId)
              ]),
              JsonTextField(label: 'Patch JSON', controller: _secretBody)
            ],
            action: () => widget.api.put(
                '/api/v1/admin/secrets/${Uri.encodeComponent(_secretId.text.trim())}',
                body: parseJsonObject(_secretBody.text))),
        JsonActionCard(
            title: 'Delete secret',
            actionKind: AdminActionKind.destructive,
            actionId: 'secrets.delete-secret',
            actionLabel: 'Delete',
            confirmation: const AdminConfirmation(
              title: 'Delete secret?',
              consequence:
                  'This permanently removes the selected secret and may break dependent services.',
              confirmLabel: 'Delete secret',
            ),
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Secret ID', controller: _secretId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/secrets/${Uri.encodeComponent(_secretId.text.trim())}')),
        JsonActionCard(
            title: 'Reveal secret value',
            actionKind: AdminActionKind.destructive,
            actionId: 'secrets.reveal-secret-value',
            actionLabel: 'Reveal',
            resultTtl: const Duration(seconds: 30),
            confirmation: const AdminConfirmation(
              title: 'Reveal secret value?',
              consequence:
                  'This exposes plaintext secret material in the admin response and on screen.',
              confirmLabel: 'Reveal value',
            ),
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Secret ID', controller: _secretId),
                LabeledTextField(
                    label: 'Break-glass reason',
                    controller: _breakGlassReason,
                    hint: 'Required in production (minimum 8 characters)')
              ])
            ],
            action: () => widget.api.post(
                '/api/v1/admin/secrets/${Uri.encodeComponent(_secretId.text.trim())}/reveal',
                body: {'reason': _requiredBreakGlassReason()})),
        JsonActionCard(
            title: 'Generate value',
            actionKind: AdminActionKind.mutation,
            actionLabel: 'Generate',
            children: [
              JsonTextField(label: 'Generate JSON', controller: _generateBody)
            ],
            action: () => widget.api.post('/api/v1/admin/secrets/generate',
                body: parseJsonObject(_generateBody.text))),
      ]);

  Widget _categories() => PageLayout(children: [
        const SectionTitle('Secret Categories',
            subtitle: 'secret category 목록과 생성'),
        JsonActionCard(
            title: 'List categories',
            actionKind: AdminActionKind.read,
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/secrets/categories')),
        JsonActionCard(
            title: 'Create category',
            actionKind: AdminActionKind.mutation,
            actionLabel: 'Create',
            children: [
              JsonTextField(label: 'Category JSON', controller: _categoryBody)
            ],
            action: () => widget.api.post('/api/v1/admin/secrets/categories',
                body: parseJsonObject(_categoryBody.text))),
      ]);

  Widget _audit() => PageLayout(children: [
        const SectionTitle('Secret Audit',
            subtitle: 'secret access/change audit 로그'),
        JsonActionCard(
            title: 'Audit log',
            actionKind: AdminActionKind.read,
            autoRun: true,
            children: [
              JsonTextField(
                  label: 'Query JSON strings', controller: _auditQuery)
            ],
            action: () {
              final raw = parseJsonObject(_auditQuery.text);
              return widget.api.get('/api/v1/admin/secrets/audit',
                  query: raw
                      .map((key, value) => MapEntry(key, value?.toString())));
            }),
      ]);

  Widget _importExport() => PageLayout(children: [
        const SectionTitle('Import / Export',
            subtitle:
                'secret export/import. 값 포함 export는 권한과 네트워크 보안을 확인한 뒤 실행합니다.'),
        SwitchListTile(
            title: const Text('includeValues'),
            value: _includeValues,
            onChanged: (value) => setState(() => _includeValues = value)),
        if (_includeValues) ...[
          LabeledTextField(
              label: 'Break-glass reason',
              controller: _breakGlassReason,
              hint: 'Required in production (minimum 8 characters)'),
          const SizedBox(height: 12),
        ],
        JsonActionCard(
            title: 'Export secrets',
            actionKind: AdminActionKind.destructive,
            actionId: 'secrets.export-secrets',
            actionLabel: 'Export',
            resultTtl: _includeValues ? const Duration(seconds: 30) : null,
            confirmation: const AdminConfirmation(
              title: 'Export secrets?',
              consequence:
                  'When includeValues is enabled, this response contains plaintext secret values that can be copied or logged.',
              confirmLabel: 'Export secrets',
            ),
            action: () =>
                widget.api.get('/api/v1/admin/secrets/export', headers: {
                  if (_includeValues)
                    'X-Break-Glass-Reason': _requiredBreakGlassReason(),
                }, query: {
                  'includeValues': _includeValues ? 'true' : ''
                })),
        JsonActionCard(
            title: 'Import secrets',
            actionKind: AdminActionKind.destructive,
            actionId: 'secrets.import-secrets',
            actionLabel: 'Import',
            confirmation: const AdminConfirmation(
              title: 'Import secrets?',
              consequence:
                  'This writes credentials to the secret store and may overwrite existing values when requested.',
              confirmLabel: 'Import secrets',
            ),
            children: [
              JsonTextField(label: 'Import body JSON', controller: _importBody)
            ],
            action: () => widget.api.post('/api/v1/admin/secrets/import',
                body: parseJsonObject(_importBody.text))),
      ]);

  String _requiredBreakGlassReason() {
    final reason = _breakGlassReason.text.trim();
    if (reason.length < 8) {
      throw const FormatException(
          'Enter a break-glass reason of at least 8 characters.');
    }
    return reason;
  }
}
