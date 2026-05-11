import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';

import '../core/api_client.dart';
import '../core/auth_store.dart';
import '../widgets/form_widgets.dart';
import '../widgets/json_view.dart';
import '../widgets/page_layout.dart';

class NewPostPage extends StatefulWidget {
  const NewPostPage({super.key, required this.api, required this.auth});

  final AdminApiClient api;
  final AuthStore auth;

  @override
  State<NewPostPage> createState() => _NewPostPageState();
}

class _NewPostPageState extends State<NewPostPage> {
  final _uuid = const Uuid();
  final _title = TextEditingController(text: 'New Post');
  final _slug = TextEditingController(text: 'new-post');
  final _year = TextEditingController(text: DateTime.now().year.toString());
  final _category = TextEditingController(text: 'General');
  final _tags = TextEditingController(text: 'admin, flutter');
  final _coverImage = TextEditingController();
  final _content = TextEditingController(text: '## 개요\n\n본문을 작성하세요.\n');
  final _aiPrompt = TextEditingController(
      text:
          'A clean editorial blog cover image about software architecture, no text');
  final _aiAlt = TextEditingController(text: 'Blog cover image');
  final _aiSize = TextEditingController(text: '1024x1024');
  final _aiQuality = TextEditingController(text: 'medium');
  final _aiCount = TextEditingController(text: '1');
  bool _published = true;
  bool _busy = false;
  Object? _lastResult;
  Object? _lastImageResult;
  String? _error;
  final List<PickedUpload> _files = [];

  @override
  void dispose() {
    for (final c in [
      _title,
      _slug,
      _year,
      _category,
      _tags,
      _coverImage,
      _content,
      _aiPrompt,
      _aiAlt,
      _aiSize,
      _aiQuality,
      _aiCount
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String _normalizedSlug() {
    final raw =
        _slug.text.trim().isNotEmpty ? _slug.text.trim() : _title.text.trim();
    final normalized = raw
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9\-\s_]'), '')
        .replaceAll(RegExp(r'[\s_]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    return normalized.isEmpty ? 'post' : normalized;
  }

  List<String> _tagList() => _tags.text
      .split(',')
      .map((tag) => tag.trim())
      .where((tag) => tag.isNotEmpty)
      .toList(growable: false);

  String? _mimeForExtension(String? extension) {
    final ext = extension?.toLowerCase().trim();
    return switch (ext) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      _ => null,
    };
  }

  Future<void> _run(Future<Object?> Function() action,
      {bool imageResult = false}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await action();
      if (!mounted) return;
      setState(() {
        if (imageResult) {
          _lastImageResult = result;
        } else {
          _lastResult = result;
        }
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickImages() async {
    final result = await FilePicker.platform
        .pickFiles(type: FileType.image, allowMultiple: true, withData: true);
    if (result == null) return;
    final picked = result.files.where((file) => file.bytes != null).map((file) {
      return PickedUpload(
          name: file.name,
          bytes: file.bytes!,
          contentType: _mimeForExtension(file.extension));
    });
    setState(() => _files.addAll(picked));
  }

  Future<Object?> _uploadImages() async {
    if (_files.isEmpty) throw Exception('Select at least one image first.');
    final result = await widget.api.multipart(
      '/api/v1/images/upload',
      fields: {'year': _year.text.trim(), 'slug': _normalizedSlug()},
      files: _files,
      fileField: 'files',
    );
    final items = result['items'];
    if (items is List) {
      final buffer = StringBuffer(_content.text.trimRight());
      for (final item in items) {
        if (item is Map) {
          final candidate = item['variantWebp'] is Map
              ? (item['variantWebp'] as Map)['url']
              : item['url'];
          final url = candidate?.toString();
          if (url != null && url.isNotEmpty) {
            buffer.write('\n\n![${_title.text}]($url)');
          }
        }
      }
      _content.text = '${buffer.toString()}\n';
    }
    return result;
  }

  Future<Object?> _createPr() {
    return widget.api.post('/api/v1/admin/create-post-pr', body: {
      'title': _title.text.trim().isEmpty ? 'New Post' : _title.text.trim(),
      'slug': _normalizedSlug(),
      'year': _year.text.trim(),
      'content': _content.text,
      'draft': !_published,
      'frontmatter': {
        'category':
            _category.text.trim().isEmpty ? 'General' : _category.text.trim(),
        'tags': _tagList(),
        if (_coverImage.text.trim().isNotEmpty)
          'coverImage': _coverImage.text.trim(),
        'published': _published,
      },
    });
  }

  Future<Object?> _generateImage() async {
    final result = await widget.api.post(
      '/api/v1/admin/ai-images/generate',
      headers: {'X-Request-Id': 'flutter-admin-${_uuid.v4()}'},
      body: {
        'year': _year.text.trim(),
        'slug': _normalizedSlug(),
        'prompt': _aiPrompt.text.trim(),
        'n': int.tryParse(_aiCount.text.trim()) ?? 1,
        'size': _aiSize.text.trim().isEmpty ? '1024x1024' : _aiSize.text.trim(),
        'quality':
            _aiQuality.text.trim().isEmpty ? 'medium' : _aiQuality.text.trim(),
        'outputFormat': 'png',
        if (_aiAlt.text.trim().isNotEmpty) 'alt': _aiAlt.text.trim(),
      },
    );
    final items = result['items'];
    if (items is List && items.isNotEmpty) {
      final first = items.first;
      if (first is Map &&
          first['url'] != null &&
          _coverImage.text.trim().isEmpty) {
        _coverImage.text = first['url'].toString();
      }
    }
    return result;
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
                Tab(text: 'Compose'),
                Tab(text: 'Upload Images'),
                Tab(text: 'AI Image'),
                Tab(text: 'Preview'),
              ],
            ),
          ),
          Expanded(
              child: TabBarView(
                  children: [_compose(), _upload(), _aiImage(), _preview()])),
        ],
      ),
    );
  }

  Widget _compose() => PageLayout(children: [
        const SectionTitle('New Post',
            subtitle:
                'Markdown 게시글을 만들고 backend outbox를 통해 GitHub PR 생성을 요청합니다.'),
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
                    LabeledTextField(
                        label: 'Title',
                        controller: _title,
                        onChanged: (_) => setState(() {})),
                    LabeledTextField(
                        label: 'Slug',
                        controller: _slug,
                        onChanged: (_) => setState(() {})),
                    LabeledTextField(
                        label: 'Year',
                        controller: _year,
                        keyboardType: TextInputType.number),
                    LabeledTextField(label: 'Category', controller: _category),
                    LabeledTextField(
                        label: 'Tags comma-separated', controller: _tags),
                    LabeledTextField(
                        label: 'Cover image URL',
                        controller: _coverImage,
                        onChanged: (_) => setState(() {})),
                  ]),
                  const SizedBox(height: 12),
                  SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Published'),
                      value: _published,
                      onChanged: (value) => setState(() => _published = value)),
                  const SizedBox(height: 12),
                  LabeledTextField(
                      label: 'Markdown content',
                      controller: _content,
                      minLines: 14,
                      maxLines: 28,
                      onChanged: (_) => setState(() {})),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilledButton.icon(
                        onPressed: _busy ? null : () => _run(_createPr),
                        icon: const Icon(Icons.call_split),
                        label: Text(_busy ? 'Working...' : 'Create post PR')),
                    FilledButton.tonalIcon(
                        onPressed: _busy
                            ? null
                            : () => _run(_uploadImages, imageResult: true),
                        icon: const Icon(Icons.image),
                        label: const Text('Upload selected images')),
                  ]),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    MaterialBanner(
                        content: SelectableText(_error!),
                        leading: const Icon(Icons.error_outline),
                        actions: [
                          TextButton(
                              onPressed: () => setState(() => _error = null),
                              child: const Text('Dismiss'))
                        ]),
                  ],
                ]),
          ),
        ),
        if (_lastResult != null) JsonView(value: _lastResult, maxHeight: 420),
      ]);

  Widget _upload() => PageLayout(children: [
        const SectionTitle('Image Upload',
            subtitle:
                'POST /api/v1/images/upload. 선택한 이미지는 year/slug 경로에 업로드되고 Markdown에 삽입됩니다.'),
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
                    LabeledTextField(label: 'Year', controller: _year),
                    LabeledTextField(label: 'Slug', controller: _slug),
                  ]),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilledButton.tonalIcon(
                        onPressed: _busy ? null : _pickImages,
                        icon: const Icon(Icons.add_photo_alternate),
                        label: const Text('Select images')),
                    FilledButton.icon(
                        onPressed: _busy
                            ? null
                            : () => _run(_uploadImages, imageResult: true),
                        icon: const Icon(Icons.upload),
                        label: Text(_busy ? 'Working...' : 'Upload')),
                    TextButton.icon(
                        onPressed: _files.isEmpty
                            ? null
                            : () => setState(_files.clear),
                        icon: const Icon(Icons.clear),
                        label: const Text('Clear selection')),
                  ]),
                  const SizedBox(height: 12),
                  if (_files.isEmpty)
                    const Text('No images selected.')
                  else
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final file in _files)
                        Chip(
                            label: Text(
                                '${file.name} · ${(file.bytes.length / 1024).toStringAsFixed(1)} KB')),
                    ]),
                ]),
          ),
        ),
        if (_lastImageResult != null)
          JsonView(value: _lastImageResult, maxHeight: 420),
      ]);

  Widget _aiImage() => PageLayout(children: [
        const SectionTitle('Admin AI Image',
            subtitle: 'backend LiteLLM image generation 상태 확인과 이미지 생성을 실행합니다.'),
        JsonActionCard(
            title: 'AI image health',
            description: 'GET /api/v1/admin/ai-images/health',
            action: () => widget.api.get('/api/v1/admin/ai-images/health')),
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
                    LabeledTextField(label: 'Year', controller: _year),
                    LabeledTextField(label: 'Slug', controller: _slug),
                    LabeledTextField(
                        label: 'Count',
                        controller: _aiCount,
                        keyboardType: TextInputType.number),
                    LabeledTextField(
                        label: 'Size', controller: _aiSize, hint: '1024x1024'),
                    LabeledTextField(
                        label: 'Quality',
                        controller: _aiQuality,
                        hint: 'medium'),
                    LabeledTextField(label: 'Alt text', controller: _aiAlt),
                  ]),
                  const SizedBox(height: 12),
                  LabeledTextField(
                      label: 'Prompt',
                      controller: _aiPrompt,
                      minLines: 4,
                      maxLines: 8),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _run(_generateImage, imageResult: true),
                      icon: const Icon(Icons.auto_awesome),
                      label: Text(_busy ? 'Working...' : 'Generate image')),
                ]),
          ),
        ),
        if (_lastImageResult != null) ...[
          _GeneratedImageStrip(
              result: _lastImageResult, baseUrl: widget.auth.baseUrl),
          JsonView(value: _lastImageResult, maxHeight: 420),
        ],
      ]);

  Widget _preview() => PageLayout(children: [
        const SectionTitle('Preview',
            subtitle: '현재 입력값으로 생성될 frontmatter와 Markdown 렌더링을 확인합니다.'),
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
                  Text('frontmatter',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  JsonView(value: {
                    'title': _title.text,
                    'year': _year.text,
                    'slug': _normalizedSlug(),
                    'category': _category.text,
                    'tags': _tagList(),
                    'coverImage': _coverImage.text,
                    'published': _published,
                  }, maxHeight: 240),
                  const SizedBox(height: 16),
                  Text('Markdown',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  DecoratedBox(
                    decoration: BoxDecoration(
                        border:
                            Border.all(color: Theme.of(context).dividerColor),
                        borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: MarkdownBody(data: _content.text)),
                  ),
                ]),
          ),
        ),
      ]);
}

class _GeneratedImageStrip extends StatelessWidget {
  const _GeneratedImageStrip({required this.result, required this.baseUrl});

  final Object? result;
  final String baseUrl;

  @override
  Widget build(BuildContext context) {
    final items = result is Map ? (result as Map)['items'] : null;
    if (items is! List || items.isEmpty) return const SizedBox.shrink();
    final urls = items
        .whereType<Map>()
        .map((item) => item['url']?.toString())
        .where((url) => url != null && url.isNotEmpty)
        .cast<String>()
        .toList(growable: false);
    if (urls.isEmpty) return const SizedBox.shrink();

    String absolute(String url) => url.startsWith('http')
        ? url
        : '${baseUrl.replaceAll(RegExp(r'/+$'), '')}$url';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Theme.of(context).dividerColor)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Generated images',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          SizedBox(
            height: 180,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: urls.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final url = absolute(urls[index]);
                return Column(children: [
                  ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(url,
                          height: 140, width: 140, fit: BoxFit.cover)),
                  TextButton(
                      onPressed: () => launchUrl(Uri.parse(url),
                          mode: LaunchMode.externalApplication),
                      child: const Text('Open')),
                ]);
              },
            ),
          ),
        ]),
      ),
    );
  }
}
