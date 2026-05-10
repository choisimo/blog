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
          description: 'GET /api/v1/healthz',
          autoRun: true,
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/healthz', authRequired: false),
        ),
        JsonActionCard(
          title: 'RAG health',
          description: 'GET /api/v1/rag/health',
          autoRun: true,
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/rag/health', authRequired: false),
        ),
        JsonActionCard(
          title: 'Agent health',
          description: 'GET /api/v1/agent/health',
          autoRun: true,
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/agent/health'),
        ),
        JsonActionCard(
          title: 'AI providers list',
          description: 'GET /api/v1/admin/ai/providers',
          autoRun: true,
          actionLabel: 'Refresh',
          action: () => api.get('/api/v1/admin/ai/providers'),
        ),
      ],
    );
  }
}
