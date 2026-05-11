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
  final _validateBody = TextEditingController(text: '{}');
  final _saveBody = TextEditingController(text: '{}');

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
            description: 'GET /api/v1/admin/config/categories',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/config/categories')),
        JsonActionCard(
            title: 'Current config',
            description: 'GET /api/v1/admin/config/current',
            autoRun: true,
            action: () => widget.api.get('/api/v1/admin/config/current')),
        JsonActionCard(
            title: 'Schema',
            description: 'GET /api/v1/admin/config/schema',
            action: () => widget.api.get('/api/v1/admin/config/schema')),
        JsonActionCard(
            title: 'Export config',
            description: 'POST /api/v1/admin/config/export',
            actionLabel: 'Export',
            action: () => widget.api.post('/api/v1/admin/config/export')),
        JsonActionCard(
          title: 'Validate values',
          description: 'POST /api/v1/admin/config/validate',
          actionLabel: 'Validate',
          children: [
            JsonTextField(label: 'Values JSON', controller: _validateBody)
          ],
          action: () => widget.api.post('/api/v1/admin/config/validate',
              body: parseJsonObject(_validateBody.text)),
        ),
        JsonActionCard(
          title: 'Save env',
          description: 'POST /api/v1/admin/config/save-env',
          actionLabel: 'Save .env',
          children: [
            JsonTextField(
                label: 'Values JSON',
                controller: _saveBody,
                example: '{"values":{"KEY":"value"}}')
          ],
          action: () => widget.api.post('/api/v1/admin/config/save-env',
              body: parseJsonObject(_saveBody.text)),
        ),
      ],
    );
  }
}
