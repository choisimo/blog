import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class AiPage extends StatefulWidget {
  const AiPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<AiPage> createState() => _AiPageState();
}

class _AiPageState extends State<AiPage> {
  final _providerId = TextEditingController();
  final _providerBody = TextEditingController(text: '''{
  "name": "openrouter",
  "display_name": "OpenRouter",
  "api_base_url": "https://openrouter.ai/api/v1",
  "api_key_env": "OPENROUTER_API_KEY"
}''');
  final _modelId = TextEditingController();
  final _modelQueryProvider = TextEditingController();
  final _modelBody = TextEditingController(text: '''{
  "provider_id": "provider-id",
  "model_name": "model-name",
  "display_name": "Display Name",
  "context_window": 128000,
  "is_enabled": true
}''');
  final _routeId = TextEditingController();
  final _routeBody = TextEditingController(text: '''{
  "route_name": "chat_default",
  "primary_model_id": "model-id",
  "fallback_model_ids": [],
  "is_enabled": true
}''');
  final _playgroundBody = TextEditingController(text: '''{
  "model_ids": [],
  "system_prompt": "You are a concise assistant.",
  "user_prompt": "Return a short test response.",
  "temperature": 0.2,
  "max_tokens": 256
}''');
  final _historyId = TextEditingController();
  final _usageQuery = TextEditingController(text: '{}');
  final _traceId = TextEditingController();
  final _traceQuery =
      TextEditingController(text: '{"limit":"50","offset":"0"}');
  final _hours = TextEditingController(text: '24');
  final _mode = TextEditingController(text: 'default');
  final _promptBody = TextEditingController(text: '{"prompt":""}');
  final _templateId = TextEditingController();
  final _templateBody = TextEditingController(text: '''{
  "name": "Template name",
  "description": "Reusable prompt template",
  "system_prompt": "System prompt",
  "user_prompt": "User prompt with {{input}}",
  "variables": ["input"]
}''');

  @override
  void dispose() {
    for (final c in [
      _providerId,
      _providerBody,
      _modelId,
      _modelQueryProvider,
      _modelBody,
      _routeId,
      _routeBody,
      _playgroundBody,
      _historyId,
      _usageQuery,
      _traceId,
      _traceQuery,
      _hours,
      _mode,
      _promptBody,
      _templateId,
      _templateBody
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 8,
      child: Column(
        children: [
          const Material(
            child: TabBar(
              isScrollable: true,
              tabs: [
                Tab(text: 'Providers'),
                Tab(text: 'Models'),
                Tab(text: 'Routes'),
                Tab(text: 'Playground'),
                Tab(text: 'Usage'),
                Tab(text: 'Traces'),
                Tab(text: 'Prompts'),
                Tab(text: 'Templates'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _providers(),
                _models(),
                _routes(),
                _playground(),
                _usage(),
                _traces(),
                _prompts(),
                _templates(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _providers() => PageLayout(children: [
        const SectionTitle('AI Providers',
            subtitle: 'GET/POST/PUT/DELETE /api/v1/admin/ai/providers'),
        JsonActionCard(
            title: 'List providers',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/ai/providers')),
        JsonActionCard(
          title: 'Create provider',
          actionLabel: 'Create',
          children: [
            JsonTextField(label: 'Provider JSON', controller: _providerBody)
          ],
          action: () => widget.api.post('/api/v1/admin/ai/providers',
              body: parseJsonObject(_providerBody.text)),
        ),
        JsonActionCard(
          title: 'Update provider',
          actionLabel: 'Update',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Provider ID', controller: _providerId)
            ]),
            JsonTextField(label: 'Patch JSON', controller: _providerBody)
          ],
          action: () => widget.api.put(
              '/api/v1/admin/ai/providers/${Uri.encodeComponent(_providerId.text.trim())}',
              body: parseJsonObject(_providerBody.text)),
        ),
        JsonActionCard(
          title: 'Provider operations',
          description: 'health, kill-switch, enable, delete',
          actionLabel: 'Run health check',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Provider ID', controller: _providerId)
            ])
          ],
          action: () => widget.api.put(
              '/api/v1/admin/ai/providers/${Uri.encodeComponent(_providerId.text.trim())}/health'),
        ),
        JsonActionCard(
            title: 'Kill switch provider',
            actionLabel: 'Kill switch',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Provider ID', controller: _providerId)
              ])
            ],
            action: () => widget.api.post(
                '/api/v1/admin/ai/providers/${Uri.encodeComponent(_providerId.text.trim())}/kill-switch')),
        JsonActionCard(
            title: 'Enable provider',
            actionLabel: 'Enable',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Provider ID', controller: _providerId)
              ])
            ],
            action: () => widget.api.post(
                '/api/v1/admin/ai/providers/${Uri.encodeComponent(_providerId.text.trim())}/enable')),
        JsonActionCard(
            title: 'Delete provider',
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Provider ID', controller: _providerId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/ai/providers/${Uri.encodeComponent(_providerId.text.trim())}')),
      ]);

  Widget _models() => PageLayout(children: [
        const SectionTitle('AI Models',
            subtitle: '모델 목록, 생성, 수정, 삭제, playground 기반 테스트'),
        JsonActionCard(
          title: 'List models',
          autoRun: true,
          children: [
            ControlGrid(children: [
              LabeledTextField(
                  label: 'provider_id filter', controller: _modelQueryProvider)
            ])
          ],
          action: () => widget.api.get('/api/v1/admin/ai/models',
              query: {'provider_id': _modelQueryProvider.text}),
        ),
        JsonActionCard(
            title: 'Create model',
            actionLabel: 'Create',
            children: [
              JsonTextField(label: 'Model JSON', controller: _modelBody)
            ],
            action: () => widget.api.post('/api/v1/admin/ai/models',
                body: parseJsonObject(_modelBody.text))),
        JsonActionCard(
            title: 'Update model',
            actionLabel: 'Update',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Model ID', controller: _modelId)
              ]),
              JsonTextField(label: 'Patch JSON', controller: _modelBody)
            ],
            action: () => widget.api.put(
                '/api/v1/admin/ai/models/${Uri.encodeComponent(_modelId.text.trim())}',
                body: parseJsonObject(_modelBody.text))),
        JsonActionCard(
            title: 'Delete model',
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Model ID', controller: _modelId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/ai/models/${Uri.encodeComponent(_modelId.text.trim())}')),
        JsonActionCard(
            title: 'Test model',
            description: 'POST /api/v1/admin/ai/playground/run',
            actionLabel: 'Test',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Model ID', controller: _modelId)
              ])
            ],
            action: () =>
                widget.api.post('/api/v1/admin/ai/playground/run', body: {
                  'model_ids': [_modelId.text.trim()],
                  'user_prompt':
                      'Return a short health-check response for this model.'
                })),
      ]);

  Widget _routes() => PageLayout(children: [
        const SectionTitle('AI Routes', subtitle: '모델 라우팅 정책을 관리합니다.'),
        JsonActionCard(
            title: 'List routes',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/ai/routes')),
        JsonActionCard(
            title: 'Create route',
            actionLabel: 'Create',
            children: [
              JsonTextField(label: 'Route JSON', controller: _routeBody)
            ],
            action: () => widget.api.post('/api/v1/admin/ai/routes',
                body: parseJsonObject(_routeBody.text))),
        JsonActionCard(
            title: 'Update route',
            actionLabel: 'Update',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Route ID', controller: _routeId)
              ]),
              JsonTextField(label: 'Patch JSON', controller: _routeBody)
            ],
            action: () => widget.api.put(
                '/api/v1/admin/ai/routes/${Uri.encodeComponent(_routeId.text.trim())}',
                body: parseJsonObject(_routeBody.text))),
        JsonActionCard(
            title: 'Delete route',
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Route ID', controller: _routeId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/ai/routes/${Uri.encodeComponent(_routeId.text.trim())}')),
      ]);

  Widget _playground() => PageLayout(children: [
        const SectionTitle('AI Playground', subtitle: '모델 실행과 실행 이력을 관리합니다.'),
        JsonActionCard(
            title: 'Run playground',
            description: 'POST /api/v1/admin/ai/playground/run',
            actionLabel: 'Run',
            children: [
              JsonTextField(label: 'Run JSON', controller: _playgroundBody)
            ],
            action: () => widget.api.post('/api/v1/admin/ai/playground/run',
                body: parseJsonObject(_playgroundBody.text))),
        JsonActionCard(
            title: 'History',
            description: 'GET /api/v1/admin/ai/playground/history',
            autoRun: true,
            action: () =>
                widget.api.get('/api/v1/admin/ai/playground/history')),
        JsonActionCard(
            title: 'History detail',
            actionLabel: 'Load detail',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'History ID', controller: _historyId)
              ])
            ],
            action: () => widget.api.get(
                '/api/v1/admin/ai/playground/history/${Uri.encodeComponent(_historyId.text.trim())}')),
        JsonActionCard(
            title: 'Delete history item',
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'History ID', controller: _historyId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/ai/playground/history/${Uri.encodeComponent(_historyId.text.trim())}')),
        JsonActionCard(
            title: 'Clear history',
            actionLabel: 'Clear',
            action: () =>
                widget.api.delete('/api/v1/admin/ai/playground/history')),
      ]);

  Widget _usage() => PageLayout(children: [
        const SectionTitle('AI Usage',
            subtitle: '기간, provider, model 기준 사용량을 조회하고 config export를 실행합니다.'),
        JsonActionCard(
            title: 'Usage query',
            description: 'GET /api/v1/admin/ai/usage',
            autoRun: true,
            children: [
              JsonTextField(
                  label: 'Query JSON strings',
                  controller: _usageQuery,
                  example:
                      '{"start_date":"2026-05-01","end_date":"2026-05-09"}')
            ],
            action: () {
              final raw = parseJsonObject(_usageQuery.text);
              final query =
                  raw.map((key, value) => MapEntry(key, value?.toString()));
              return widget.api.get('/api/v1/admin/ai/usage', query: query);
            }),
        JsonActionCard(
            title: 'Export AI config',
            description: 'GET /api/v1/admin/ai/config/export',
            action: () => widget.api.get('/api/v1/admin/ai/config/export')),
      ]);

  Widget _traces() => PageLayout(children: [
        const SectionTitle('AI Traces', subtitle: 'AI 호출 trace와 요약 통계를 확인합니다.'),
        JsonActionCard(
            title: 'Trace list',
            description: 'GET /api/v1/admin/ai/traces',
            autoRun: true,
            children: [
              JsonTextField(
                  label: 'Query JSON strings', controller: _traceQuery)
            ],
            action: () {
              final raw = parseJsonObject(_traceQuery.text);
              return widget.api.get('/api/v1/admin/ai/traces',
                  query: raw
                      .map((key, value) => MapEntry(key, value?.toString())));
            }),
        JsonActionCard(
            title: 'Trace detail',
            actionLabel: 'Load detail',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Trace ID', controller: _traceId)
              ])
            ],
            action: () => widget.api.get(
                '/api/v1/admin/ai/traces/${Uri.encodeComponent(_traceId.text.trim())}')),
        JsonActionCard(
            title: 'Trace summary',
            description: 'GET /api/v1/admin/ai/traces/stats/summary',
            children: [
              ControlGrid(children: [
                LabeledTextField(
                    label: 'hours',
                    controller: _hours,
                    keyboardType: TextInputType.number)
              ])
            ],
            action: () => widget.api.get(
                '/api/v1/admin/ai/traces/stats/summary',
                query: {'hours': _hours.text})),
      ]);

  Widget _prompts() => PageLayout(children: [
        const SectionTitle('Agent Prompts',
            subtitle: 'backend /api/v1/agent/prompts 관리자 프롬프트를 관리합니다.'),
        JsonActionCard(
            title: 'List prompts',
            autoRun: true,
            action: () => widget.api.get('/api/v1/agent/prompts')),
        JsonActionCard(
            title: 'Update prompt mode',
            actionLabel: 'Update',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Mode', controller: _mode)
              ]),
              JsonTextField(
                  label: 'Prompt body JSON',
                  controller: _promptBody,
                  example: '{"prompt":"..."}')
            ],
            action: () => widget.api.put(
                '/api/v1/agent/prompts/${Uri.encodeComponent(_mode.text.trim())}',
                body: parseJsonObject(_promptBody.text))),
        JsonActionCard(
            title: 'Delete prompt override',
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Mode', controller: _mode)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/agent/prompts/${Uri.encodeComponent(_mode.text.trim())}')),
      ]);

  Widget _templates() => PageLayout(children: [
        const SectionTitle('Prompt Templates',
            subtitle: '관리자 AI prompt templates CRUD와 적용 기능'),
        JsonActionCard(
            title: 'List templates',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/ai/prompt-templates')),
        JsonActionCard(
            title: 'Create template',
            actionLabel: 'Create',
            children: [
              JsonTextField(label: 'Template JSON', controller: _templateBody)
            ],
            action: () => widget.api.post('/api/v1/admin/ai/prompt-templates',
                body: parseJsonObject(_templateBody.text))),
        JsonActionCard(
            title: 'Update template',
            actionLabel: 'Update',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Template ID', controller: _templateId)
              ]),
              JsonTextField(label: 'Patch JSON', controller: _templateBody)
            ],
            action: () => widget.api.put(
                '/api/v1/admin/ai/prompt-templates/${Uri.encodeComponent(_templateId.text.trim())}',
                body: parseJsonObject(_templateBody.text))),
        JsonActionCard(
            title: 'Use template',
            actionLabel: 'Apply',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Template ID', controller: _templateId)
              ])
            ],
            action: () => widget.api.post(
                '/api/v1/admin/ai/prompt-templates/${Uri.encodeComponent(_templateId.text.trim())}/use')),
        JsonActionCard(
            title: 'Delete template',
            actionLabel: 'Delete',
            children: [
              ControlGrid(children: [
                LabeledTextField(label: 'Template ID', controller: _templateId)
              ])
            ],
            action: () => widget.api.delete(
                '/api/v1/admin/ai/prompt-templates/${Uri.encodeComponent(_templateId.text.trim())}')),
      ]);
}
