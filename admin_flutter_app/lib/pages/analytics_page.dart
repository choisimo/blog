import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class AnalyticsPage extends StatefulWidget {
  const AnalyticsPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends State<AnalyticsPage> {
  final _days = TextEditingController(text: '7');
  final _limit = TextEditingController(text: '10');
  final _offset = TextEditingController(text: '0');
  final _orderBy = TextEditingController(text: 'total_views');
  final _year = TextEditingController();
  final _slug = TextEditingController();
  final _editorPick = TextEditingController(text: '''{
  "post_slug": "example-slug",
  "year": "2026",
  "title": "Example",
  "rank": 1,
  "reason": "Manual pick",
  "expires_at": null
}''');

  @override
  void dispose() {
    _days.dispose();
    _limit.dispose();
    _offset.dispose();
    _orderBy.dispose();
    _year.dispose();
    _slug.dispose();
    _editorPick.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PageLayout(
      children: [
        const SectionTitle('Analytics Manager',
            subtitle: '방문 통계, 실시간 방문자, 에디터 픽, 게시글별 상세 로그를 관리합니다.'),
        JsonActionCard(
          title: 'Trending posts',
          description: 'GET /api/v1/analytics/trending',
          autoRun: true,
          actionLabel: 'Load trending',
          children: [
            ControlGrid(children: [
              LabeledTextField(
                  label: 'days',
                  controller: _days,
                  keyboardType: TextInputType.number),
              LabeledTextField(
                  label: 'limit',
                  controller: _limit,
                  keyboardType: TextInputType.number),
              LabeledTextField(
                  label: 'offset',
                  controller: _offset,
                  keyboardType: TextInputType.number),
            ])
          ],
          action: () => widget.api
              .get('/api/v1/analytics/trending', authRequired: false, query: {
            'days': _days.text,
            'limit': _limit.text,
            'offset': _offset.text,
          }),
        ),
        JsonActionCard(
          title: 'Realtime visitors',
          description: 'GET /api/v1/analytics/realtime',
          autoRun: true,
          action: () =>
              widget.api.get('/api/v1/analytics/realtime', authRequired: false),
        ),
        JsonActionCard(
          title: 'Editor picks',
          description: 'GET /api/v1/analytics/editor-picks',
          autoRun: true,
          action: () => widget.api.get('/api/v1/analytics/editor-picks',
              authRequired: false, query: {'limit': _limit.text}),
        ),
        JsonActionCard(
          title: 'Refresh stats',
          description: 'POST /api/v1/analytics/refresh-stats',
          actionLabel: 'Refresh stats',
          action: () => widget.api.post('/api/v1/analytics/refresh-stats'),
        ),
        JsonActionCard(
          title: 'All post stats',
          description: 'GET /api/v1/admin/analytics/posts?orderBy=',
          autoRun: true,
          children: [
            ControlGrid(children: [
              LabeledTextField(
                  label: 'orderBy',
                  controller: _orderBy,
                  hint: 'total_views | views_7d | views_30d | last_viewed_at')
            ])
          ],
          action: () => widget.api.get('/api/v1/admin/analytics/posts',
              query: {'orderBy': _orderBy.text}),
        ),
        JsonActionCard(
          title: 'Post metrics detail',
          description: 'GET metrics and visits for a single post',
          actionLabel: 'Load detail',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Year', controller: _year),
              LabeledTextField(label: 'Slug', controller: _slug),
              LabeledTextField(
                  label: 'Limit',
                  controller: _limit,
                  keyboardType: TextInputType.number),
            ])
          ],
          action: () async {
            final year = Uri.encodeComponent(_year.text.trim());
            final slug = Uri.encodeComponent(_slug.text.trim());
            final metrics = await widget.api
                .get('/api/v1/admin/analytics/posts/$year/$slug/metrics');
            final visits = await widget.api.get(
                '/api/v1/admin/analytics/posts/$year/$slug/visits',
                query: {'limit': _limit.text, 'offset': _offset.text});
            return {'metrics': metrics, 'visits': visits};
          },
        ),
        JsonActionCard(
          title: 'Create or update editor pick',
          description: 'POST /api/v1/analytics/admin/editor-picks',
          actionLabel: 'Save pick',
          children: [
            JsonTextField(label: 'Editor pick JSON', controller: _editorPick)
          ],
          action: () => widget.api.post('/api/v1/analytics/admin/editor-picks',
              body: parseJsonObject(_editorPick.text)),
        ),
        JsonActionCard(
          title: 'Update editor pick by post',
          description: 'PUT /api/v1/analytics/admin/editor-picks/:year/:slug',
          actionLabel: 'Update pick',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Year', controller: _year),
              LabeledTextField(label: 'Slug', controller: _slug),
            ]),
            JsonTextField(label: 'Patch JSON', controller: _editorPick)
          ],
          action: () => widget.api.put(
              '/api/v1/analytics/admin/editor-picks/${Uri.encodeComponent(_year.text.trim())}/${Uri.encodeComponent(_slug.text.trim())}',
              body: parseJsonObject(_editorPick.text)),
        ),
        JsonActionCard(
          title: 'Remove editor pick',
          description:
              'DELETE /api/v1/analytics/admin/editor-picks/:year/:slug',
          actionLabel: 'Remove pick',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Year', controller: _year),
              LabeledTextField(label: 'Slug', controller: _slug),
            ])
          ],
          action: () => widget.api.delete(
              '/api/v1/analytics/admin/editor-picks/${Uri.encodeComponent(_year.text.trim())}/${Uri.encodeComponent(_slug.text.trim())}'),
        ),
      ],
    );
  }
}
