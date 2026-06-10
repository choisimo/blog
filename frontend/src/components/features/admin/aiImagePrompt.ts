type PromptContext = {
  title: string;
  category: string;
  tags: string;
  content: string;
};

const REQUIRED_RENDERING_CONSTRAINTS_HEADER = 'Required rendering constraints:';

const FLAT_RASTER_RENDERING_CONSTRAINTS = [
  'Render as a flat 2D raster image with crisp diagram-safe edges and readable spacing.',
  'Do not generate 3D, isometric depth, perspective objects, photorealistic scenes, shadows, drop shadows, contact shadows, bevels, glows, reflections, robots, humanoid AI agents, chatbot avatars, assistant characters, faces, hands, or floating agent UI.',
].join('\n');

const STATE_MACHINE_TERMS = [
  'state machine',
  'state-machine',
  'process state',
  'status machine',
  '상태머신',
  '상태 머신',
  '프로세스 상태',
];

const STATE_MACHINE_RASTER_CONSTRAINTS = [
  'For state-machine content, create a clean state-machine diagram as a raster image: labeled flat nodes, directed arrows, concise transition labels, and a white or off-white background.',
  'Use only the necessary state and transition text inside the diagram; avoid decorative captions, code screens, characters, agents, or scene illustrations.',
].join('\n');

function compactContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 900);
}

function buildRenderingConstraints(input: string): string {
  return [
    REQUIRED_RENDERING_CONSTRAINTS_HEADER,
    FLAT_RASTER_RENDERING_CONSTRAINTS,
    hasStateMachineDiagramIntent(input) ? STATE_MACHINE_RASTER_CONSTRAINTS : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function hasStateMachineDiagramIntent(value: string): boolean {
  const normalized = value.toLowerCase();
  return STATE_MACHINE_TERMS.some((term) => normalized.includes(term));
}

export function buildFinalImagePrompt(rawPrompt: string, suggestedPrompt: string): string {
  const basePrompt = rawPrompt.trim() || suggestedPrompt;
  if (basePrompt.includes(REQUIRED_RENDERING_CONSTRAINTS_HEADER)) {
    return basePrompt;
  }
  return [basePrompt, buildRenderingConstraints(basePrompt)].join('\n\n');
}

export function buildSuggestedPrompt({
  title,
  category,
  tags,
  content,
}: PromptContext): string {
  const normalizedTitle = title.trim() || 'Untitled blog post';
  const normalizedCategory = category.trim() || 'General';
  const normalizedTags = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
  const body = compactContent(content);
  const context = [
    `Title: ${normalizedTitle}`,
    `Category: ${normalizedCategory}`,
    normalizedTags ? `Tags: ${normalizedTags}` : '',
    body ? `Article excerpt: ${body}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const isStateMachineDiagram = hasStateMachineDiagramIntent(context);
  const primaryInstruction = isStateMachineDiagram
    ? 'Create a flat 2D raster state-machine diagram for the article below.'
    : 'Create a polished editorial blog raster image for the article below.';
  const contentInstruction = isStateMachineDiagram
    ? 'Use labeled nodes, directed arrows, and concise transition labels; keep the diagram readable at blog width.'
    : 'Use a clean modern tech-blog style, strong composition, crisp raster details, no visible text, no logos, no watermark.';

  return [
    primaryInstruction,
    contentInstruction,
    context,
    buildRenderingConstraints(context),
  ].join('\n\n');
}
