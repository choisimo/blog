import { z } from 'zod';

const text = z.string().trim().min(1).max(2000);
const nodeSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .max(80),
  label: text,
  detail: text.optional(),
  items: z.array(text).max(30).optional(),
});

export const articleDiagramSchema = z
  .object({
    title: text,
    kind: z.enum(['flow', 'structure', 'compare']),
    caption: text.optional(),
    nodes: z.array(nodeSchema).min(1).max(60),
    edges: z
      .array(z.object({ from: text, to: text, label: text.optional() }))
      .max(120)
      .default([]),
  })
  .superRefine((diagram, ctx) => {
    const ids = new Set(diagram.nodes.map(node => node.id));
    if (ids.size !== diagram.nodes.length) {
      ctx.addIssue({ code: 'custom', message: 'Node IDs must be unique' });
    }
    if (diagram.edges.some(edge => !ids.has(edge.from) || !ids.has(edge.to))) {
      ctx.addIssue({
        code: 'custom',
        message: 'Edges must reference existing nodes',
      });
    }
  });

export type ArticleDiagramData = z.infer<typeof articleDiagramSchema>;

export function parseArticleDiagram(source: string): ArticleDiagramData | null {
  if (source.length > 100_000) return null;
  try {
    const result = articleDiagramSchema.safeParse(JSON.parse(source));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
