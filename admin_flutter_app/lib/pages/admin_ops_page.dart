import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class AdminOpsPage extends StatefulWidget {
  const AdminOpsPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<AdminOpsPage> createState() => _AdminOpsPageState();
}

class _AdminOpsPageState extends State<AdminOpsPage> {
  final _proposalBody = TextEditingController(text: '''{
  "original": {
    "year": "2026",
    "slug": "existing-post",
    "path": "/posts/2026/existing-post.md",
    "url": "/posts/2026/existing-post"
  },
  "markdown": "---\\ntitle: Revised post\\n---\\n\\n# Revised post\\n",
  "sourcePage": "flutter-admin"
}''');
  final _outboxStream = TextEditingController();
  final _outboxLimit = TextEditingController(text: '25');
  final _flushBody = TextEditingController(text: '''{
  "streams": ["github_pr"],
  "limit": 10
}''');
  bool _archiveDryRun = true;

  @override
  void dispose() {
    _proposalBody.dispose();
    _outboxStream.dispose();
    _outboxLimit.dispose();
    _flushBody.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          const Material(
            child: TabBar(
              isScrollable: true,
              tabs: [
                Tab(text: 'PR Ops'),
                Tab(text: 'Comments'),
                Tab(text: 'Outbox')
              ],
            ),
          ),
          Expanded(
              child: TabBarView(children: [_prOps(), _comments(), _outbox()])),
        ],
      ),
    );
  }

  Widget _prOps() => PageLayout(children: [
        const SectionTitle('PR Operations',
            subtitle: '기존 글의 새 버전을 제안하는 GitHub PR outbox 이벤트를 생성합니다.'),
        JsonActionCard(
          title: 'Propose new version',
          description: 'POST /api/v1/admin/propose-new-version',
          actionLabel: 'Create proposal event',
          children: [
            JsonTextField(label: 'Proposal JSON', controller: _proposalBody)
          ],
          action: () => widget.api.post(
            '/api/v1/admin/propose-new-version',
            headers: {
              'Idempotency-Key':
                  'flutter-propose-${DateTime.now().millisecondsSinceEpoch}'
            },
            body: parseJsonObject(_proposalBody.text),
          ),
        ),
      ]);

  Widget _comments() => PageLayout(children: [
        const SectionTitle('Comment Archive',
            subtitle: '오래된 댓글을 JSON 파일로 아카이브하는 작업을 실행하거나 dry-run으로 확인합니다.'),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Theme.of(context).dividerColor)),
          child: SwitchListTile(
            title: const Text('Dry run'),
            subtitle: const Text(
                'dryRun=true면 GitHub PR outbox 이벤트를 만들지 않고 대상만 계산합니다.'),
            value: _archiveDryRun,
            onChanged: (value) => setState(() => _archiveDryRun = value),
          ),
        ),
        JsonActionCard(
          title: 'Archive comments',
          description: 'POST /api/v1/admin/archive-comments?dryRun=1|0',
          actionLabel: _archiveDryRun ? 'Dry run' : 'Archive',
          action: () => widget.api.post('/api/v1/admin/archive-comments',
              query: {'dryRun': _archiveDryRun ? '1' : '0'}),
        ),
      ]);

  Widget _outbox() => PageLayout(children: [
        const SectionTitle('Backend Outbox',
            subtitle:
                'GitHub PR, comment archive, deploy hook 등 backend domain outbox 상태를 조회하고 flush합니다.'),
        JsonActionCard(
          title: 'List outbox events',
          description: 'GET /api/v1/admin/backend-outbox',
          autoRun: true,
          children: [
            ControlGrid(children: [
              LabeledTextField(
                  label: 'Stream filter',
                  controller: _outboxStream,
                  hint: 'optional'),
              LabeledTextField(
                  label: 'Limit',
                  controller: _outboxLimit,
                  keyboardType: TextInputType.number),
            ])
          ],
          action: () => widget.api.get('/api/v1/admin/backend-outbox', query: {
            'stream': _outboxStream.text,
            'limit': _outboxLimit.text,
          }),
        ),
        JsonActionCard(
          title: 'Flush outbox',
          description: 'POST /api/v1/admin/backend-outbox/flush',
          actionLabel: 'Flush',
          children: [
            JsonTextField(label: 'Flush JSON', controller: _flushBody)
          ],
          action: () => widget.api.post('/api/v1/admin/backend-outbox/flush',
              body: parseJsonObject(_flushBody.text)),
        ),
      ]);
}
