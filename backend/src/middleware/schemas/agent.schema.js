/**
 * Zod schemas for /api/v1/agent routes
 * @module middleware/schemas/agent.schema
 */

import { z } from 'zod';

/**
 * POST /run and POST /stream share the same body shape
 */
export const agentRunBodySchema = z.object({
  message: z.string().min(1).max(32_000),
  sessionId: z.string().max(128).optional(),
  mode: z
    .enum(['default', 'research', 'coding', 'blog', 'article', 'terminal', 'performance'])
    .optional()
    .default('default'),
  articleSlug: z.string().max(256).optional(),
  tools: z.array(z.string().max(64)).max(20).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxIterations: z.number().int().min(1).max(10).optional(),
  userId: z.string().max(128).optional(),
});

/**
 * POST /memory/extract
 */
export const memoryExtractBodySchema = z.object({
  sessionId: z.string().max(128).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(100_000),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * POST /memory/search
 */
export const memorySearchBodySchema = z.object({
  query: z.string().min(1).max(4000),
  userId: z.string().max(128).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
