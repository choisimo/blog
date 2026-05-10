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
      _importBody
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
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/secrets/overview')),
        JsonActionCard(
            title: 'Health',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/secrets/health')),
      ]);

  Widget _secrets() => PageLayout(children: [
        const SectionTitle('Secrets',
            subtitle: 'secret 목록, 생성, 수정, 삭제, reveal, generate'),
        JsonActionCard(
            title: 'List secrets',
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
            actionLabel: 'Create',
            children: [
              JsonTextField(label: 'Secret JSON', controller: _secretBody)
            ],
            action: () => widget.api.post('/api/v1/admin/secrets',
                body: parseJsonObject(_secretBody.text))),
        JsonActionCard(
            title: 'Update secret',
            actionLabel: 'Update',
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
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Secret ID', controller: _secretId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/secrets/${Uri.encodeComponent(_secretId.text.trim())}')),
        JsonActionCard(
            title: 'Reveal secret value',
            actionLabel: 'Reveal',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Secret ID', controller: _secretId)
              ])
            ],
            action: () => widget.api.post(
                '/api/v1/admin/secrets/${Uri.encodeComponent(_secretId.text.trim())}/reveal')),
        JsonActionCard(
            title: 'Generate value',
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
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/secrets/categories')),
        JsonActionCard(
            title: 'Create category',
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
        JsonActionCard(
            title: 'Export secrets',
            actionLabel: 'Export',
            action: () => widget.api.get('/api/v1/admin/secrets/export',
                query: {'includeValues': _includeValues ? 'true' : ''})),
        JsonActionCard(
            title: 'Import secrets',
            actionLabel: 'Import',
            children: [
              JsonTextField(label: 'Import body JSON', controller: _importBody)
            ],
            action: () => widget.api.post('/api/v1/admin/secrets/import',
                body: parseJsonObject(_importBody.text))),
      ]);
}
