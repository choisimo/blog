import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class HealthPage extends StatelessWidget {
  const HealthPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  Widget build(BuildContext context) {
    return PageLayout(
      children: [
        const SectionTitle('System Health',
            subtitle:
                'Backend, RAG, agent, AI provider 상태를 현재 API 기준으로 확인합니다.'),
        JsonActionCard(
          title: 'Backend health',
          actionKind: AdminActionKind.read,
          description: 'GET /api/v1/healthz',
          autoRun: true,
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/healthz', authRequired: false),
        ),
        JsonActionCard(
          title: 'RAG health',
          actionKind: AdminActionKind.read,
          description: 'GET /api/v1/rag/health',
          autoRun: true,
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/rag/health', authRequired: false),
        ),
        JsonActionCard(
          title: 'Agent health',
          actionKind: AdminActionKind.read,
          description: 'GET /api/v1/agent/health',
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/agent/health'),
        ),
        JsonActionCard(
          title: 'AI providers list',
          actionKind: AdminActionKind.read,
          description: 'GET /api/v1/admin/ai/providers',
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/admin/ai/providers'),
        ),
      ],
    );
  }
}
