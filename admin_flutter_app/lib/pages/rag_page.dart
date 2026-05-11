import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/json_utils.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class RagPage extends StatefulWidget {
  const RagPage({super.key, required this.api});

  final AdminApiClient api;

  @override
  State<RagPage> createState() => _RagPageState();
}

class _RagPageState extends State<RagPage> {
  final _collection = TextEditingController();
  final _query = TextEditingController(text: 'LLM 추론 최적화');
  final _n = TextEditingController(text: '5');
  final _texts = TextEditingController(text: '["Hello world", "안녕하세요"]');
  final _indexDocs = TextEditingController(text: '''{
  "documents": [
    {
      "id": "manual-doc-1",
      "content": "Index this text for testing.",
      "metadata": {"title": "Manual doc", "source": "flutter-admin"}
    }
  ]
}''');
  final _deleteId = TextEditingController();

  @override
  void dispose() {
    _collection.dispose();
    _query.dispose();
    _n.dispose();
    _texts.dispose();
    _indexDocs.dispose();
    _deleteId.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PageLayout(
      children: [
        const SectionTitle('RAG Manager',
            subtitle: '검색, 임베딩, 컬렉션, 인덱스 작업을 관리합니다.'),
        JsonActionCard(
          title: 'Health',
          description: 'GET /api/v1/rag/health',
          autoRun: true,
          action: () =>
              widget.api.get('/api/v1/rag/health', authRequired: false),
        ),
        JsonActionCard(
          title: 'Collections',
          description: 'GET /api/v1/rag/collections',
          autoRun: true,
          action: () => widget.api.get('/api/v1/rag/collections'),
        ),
        JsonActionCard(
          title: 'Collection status',
          description: 'GET /api/v1/rag/status?collection=',
          actionLabel: 'Get status',
          children: [
            ControlGrid(children: [
              LabeledTextField(
                  label: 'Collection (optional)', controller: _collection)
            ])
          ],
          action: () => widget.api.get('/api/v1/rag/status',
              query: {'collection': _collection.text}),
        ),
        JsonActionCard(
          title: 'Semantic search',
          description: 'POST /api/v1/rag/search',
          actionLabel: 'Search',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Query', controller: _query),
              LabeledTextField(
                  label: 'n_results',
                  controller: _n,
                  keyboardType: TextInputType.number),
            ]),
          ],
          action: () =>
              widget.api.post('/api/v1/rag/search', authRequired: false, body: {
            'query': _query.text,
            'n_results': int.tryParse(_n.text) ?? 5,
          }),
        ),
        JsonActionCard(
          title: 'Generate embeddings',
          description: 'POST /api/v1/rag/embed',
          actionLabel: 'Embed',
          children: [
            JsonTextField(label: 'Texts JSON array', controller: _texts)
          ],
          action: () => widget.api.post('/api/v1/rag/embed',
              body: {'texts': parseJsonList(_texts.text)}),
        ),
        JsonActionCard(
          title: 'Index documents',
          description: 'POST /api/v1/rag/index',
          actionLabel: 'Index',
          children: [JsonTextField(label: 'Body JSON', controller: _indexDocs)],
          action: () {
            final body = parseJsonObject(_indexDocs.text);
            if (_collection.text.trim().isNotEmpty) {
              body['collection'] = _collection.text.trim();
            }
            return widget.api.post('/api/v1/rag/index', body: body);
          },
        ),
        JsonActionCard(
          title: 'Delete indexed document',
          description: 'DELETE /api/v1/rag/index/:documentId',
          actionLabel: 'Delete',
          children: [
            ControlGrid(children: [
              LabeledTextField(label: 'Document ID', controller: _deleteId),
              LabeledTextField(
                  label: 'Collection (optional)', controller: _collection),
            ])
          ],
          action: () => widget.api.delete(
              '/api/v1/rag/index/${Uri.encodeComponent(_deleteId.text.trim())}',
              query: {'collection': _collection.text}),
        ),
      ],
    );
  }
}
