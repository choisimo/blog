import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class ConfigPage extends StatefulWidget {
  const ConfigPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<ConfigPage> createState() => _ConfigPageState();
}

class _ConfigPageState extends State<ConfigPage> {
  final _validateBody =
      TextEditingController(text: '{"key":"SITE_BASE_URL","value":""}');
  final _saveBody = TextEditingController(
      text: '{"variables":{"KEY":"value"},"target":"backend"}');

  @override
  void dispose() {
    _validateBody.dispose();
    _saveBody.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PageLayout(
      children: [
        const SectionTitle('Environment Config',
            subtitle: 'backend /api/v1/admin/config 관리자 설정 API를 사용합니다.'),
        JsonActionCard(
            title: 'Categories',
            actionKind: AdminActionKind.read,
            description: 'GET /api/v1/admin/config/categories',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/config/categories')),
        JsonActionCard(
            title: 'Current config',
            actionKind: AdminActionKind.read,
            description: 'GET /api/v1/admin/config/current',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/config/current')),
        JsonActionCard(
            title: 'Schema',
            actionKind: AdminActionKind.read,
            description: 'GET /api/v1/admin/config/schema',
            action: () => widget.api.get('/api/v1/admin/config/schema')),
        JsonActionCard(
            title: 'Export config',
            actionKind: AdminActionKind.read,
            description: 'POST /api/v1/admin/config/export',
            actionLabel: 'Export',
            action: () => widget.api.post('/api/v1/admin/config/export')),
        JsonActionCard(
          title: 'Validate values',
          actionKind: AdminActionKind.read,
          description: 'POST /api/v1/admin/config/validate',
          actionLabel: 'Validate',
          children: [
            JsonTextField(label: 'Validation JSON', controller: _validateBody)
          ],
          action: () => widget.api.post('/api/v1/admin/config/validate',
              body: parseJsonObject(_validateBody.text)),
        ),
        JsonActionCard(
          title: 'Save env',
          actionKind: AdminActionKind.destructive,
          actionId: 'config.save-env',
          confirmation: const AdminConfirmation(
            title: 'Overwrite the environment file?',
            consequence:
                'This rewrites the selected backend or root .env file, including configured secret values. A malformed payload can prevent services from starting.',
            confirmLabel: 'Overwrite .env',
          ),
          description: 'POST /api/v1/admin/config/save-env',
          actionLabel: 'Save .env',
          children: [
            JsonTextField(
                label: 'Save JSON',
                controller: _saveBody,
                example: '{"variables":{"KEY":"value"},"target":"backend"}')
          ],
          action: () => widget.api.post('/api/v1/admin/config/save-env',
              body: parseJsonObject(_saveBody.text)),
        ),
      ],
    );
  }
}
