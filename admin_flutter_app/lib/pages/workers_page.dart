import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class WorkersPage extends StatefulWidget {
  const WorkersPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<WorkersPage> createState() => _WorkersPageState();
}

class _WorkersPageState extends State<WorkersPage> {
  final _workerId = TextEditingController(text: 'api-gateway');
  final _env = TextEditingController(text: 'production');
  final _varsBody = TextEditingController(text: '''{
  "env": "production",
  "vars": {
    "BACKEND_ORIGIN": "https://blog-b.nodove.com"
  }
}''');
  final _secretBody = TextEditingController(text: '''{
  "key": "EXAMPLE_SECRET",
  "value": "replace-me",
  "env": "production"
}''');
  bool _dryRun = true;

  @override
  void dispose() {
    _workerId.dispose();
    _env.dispose();
    _varsBody.dispose();
    _secretBody.dispose();
    super.dispose();
  }

  String _encodedWorkerId() {
    final value = _workerId.text.trim();
    if (value.isEmpty) throw Exception('Worker ID is required.');
    return Uri.encodeComponent(value);
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Column(
        children: [
          const Material(
            child: TabBar(
              isScrollable: true,
              tabs: [
                Tab(text: 'Workers'),
                Tab(text: 'Resources'),
                Tab(text: 'Mutations'),
                Tab(text: 'Tail'),
              ],
            ),
          ),
          Expanded(
              child: TabBarView(
                  children: [_workers(), _resources(), _mutations(), _tail()])),
        ],
      ),
    );
  }

  Widget _workers() => PageLayout(children: [
        const SectionTitle('Cloudflare Workers',
            subtitle:
                'worker manifest, known secrets, per-worker wrangler config를 확인합니다.'),
        JsonActionCard(
          title: 'List workers',
          description: 'GET /api/v1/admin/workers/list',
          autoRun: true,
          action: () => widget.api.get('/api/v1/admin/workers/list'),
        ),
        JsonActionCard(
          title: 'Known worker secrets',
          description: 'GET /api/v1/admin/workers/secrets',
          autoRun: true,
          action: () => widget.api.get('/api/v1/admin/workers/secrets'),
        ),
        JsonActionCard(
          title: 'Worker config',
          description: 'GET /api/v1/admin/workers/:workerId/config',
          actionLabel: 'Load config',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Worker ID', controller: _workerId)
            ])
          ],
          action: () => widget.api
              .get('/api/v1/admin/workers/${_encodedWorkerId()}/config'),
        ),
      ]);

  Widget _resources() => PageLayout(children: [
        const SectionTitle('Worker Resources',
            subtitle: 'wrangler CLI를 통해 D1, KV, R2 리소스 목록을 조회합니다.'),
        JsonActionCard(
          title: 'D1 databases',
          description: 'GET /api/v1/admin/workers/d1/databases',
          autoRun: true,
          action: () => widget.api.get('/api/v1/admin/workers/d1/databases'),
        ),
        JsonActionCard(
          title: 'KV namespaces',
          description: 'GET /api/v1/admin/workers/kv/namespaces',
          autoRun: true,
          action: () => widget.api.get('/api/v1/admin/workers/kv/namespaces'),
        ),
        JsonActionCard(
          title: 'R2 buckets',
          description: 'GET /api/v1/admin/workers/r2/buckets',
          autoRun: true,
          action: () => widget.api.get('/api/v1/admin/workers/r2/buckets'),
        ),
        JsonActionCard(
          title: 'Resource snapshot',
          description: 'D1/KV/R2를 한 번에 조회합니다.',
          actionLabel: 'Refresh all',
          action: () async => {
            'd1': await widget.api.get('/api/v1/admin/workers/d1/databases'),
            'kv': await widget.api.get('/api/v1/admin/workers/kv/namespaces'),
            'r2': await widget.api.get('/api/v1/admin/workers/r2/buckets'),
          },
        ),
      ]);

  Widget _mutations() => PageLayout(children: [
        const SectionTitle('Worker Mutations',
            subtitle:
                'ADMIN_WORKER_MUTATIONS=true인 환경에서만 deploy, vars, secret 변경이 실행됩니다.'),
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
                    LabeledTextField(label: 'Worker ID', controller: _workerId),
                    LabeledTextField(
                        label: 'Environment',
                        controller: _env,
                        hint: 'development or production'),
                  ]),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Deploy dry run'),
                    subtitle: const Text(
                        'dryRun=true면 wrangler deploy --dry-run으로 실행합니다.'),
                    value: _dryRun,
                    onChanged: (value) => setState(() => _dryRun = value),
                  ),
                ]),
          ),
        ),
        JsonActionCard(
          title: 'Deploy worker',
          description: 'POST /api/v1/admin/workers/:workerId/deploy',
          actionLabel: 'Deploy',
          action: () => widget.api.post(
              '/api/v1/admin/workers/${_encodedWorkerId()}/deploy',
              body: {
                'env':
                    _env.text.trim().isEmpty ? 'production' : _env.text.trim(),
                'dryRun': _dryRun,
              }),
        ),
        JsonActionCard(
          title: 'Update manifest vars',
          description: 'POST /api/v1/admin/workers/:workerId/vars',
          actionLabel: 'Save vars',
          children: [JsonTextField(label: 'Vars JSON', controller: _varsBody)],
          action: () => widget.api.post(
              '/api/v1/admin/workers/${_encodedWorkerId()}/vars',
              body: parseJsonObject(_varsBody.text)),
        ),
        JsonActionCard(
          title: 'Set worker secret',
          description: 'POST /api/v1/admin/workers/:workerId/secret',
          actionLabel: 'Set secret',
          children: [
            JsonTextField(label: 'Secret JSON', controller: _secretBody)
          ],
          action: () => widget.api.post(
              '/api/v1/admin/workers/${_encodedWorkerId()}/secret',
              body: parseJsonObject(_secretBody.text)),
        ),
      ]);

  Widget _tail() => PageLayout(children: [
        const SectionTitle('Worker Tail',
            subtitle: '실시간 tail 스트림 대신 backend가 안내하는 wrangler tail 명령을 조회합니다.'),
        JsonActionCard(
          title: 'Tail command',
          description: 'GET /api/v1/admin/workers/:workerId/tail',
          actionLabel: 'Show command',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Worker ID', controller: _workerId)
            ])
          ],
          action: () => widget.api
              .get('/api/v1/admin/workers/${_encodedWorkerId()}/tail'),
        ),
      ]);
}
