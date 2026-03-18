/**
 * Zod schemas for /api/v1/rag routes
 * @module middleware/schemas/rag.schema
 */

import { z } from 'zod';

/**
 * POST /search - Semantic search (blog posts)
 */
export const ragSearchBodySchema = z.object({
  query: z.string().min(1).max(4000),
  n_results: z.number().int().min(1).max(50).optional().default(5),
  expand: z.boolean().optional().default(true),
  expandedOnly: z.boolean().optional().default(false),
});

/**
 * POST /embed - Generate embeddings
 */
export const ragEmbedBodySchema = z.object({
  texts: z.array(z.string().min(1).max(100_000)).min(1).max(32),
});

/**
 * POST /memories/upsert - Upsert user memory embeddings
 */
export const memoriesUpsertBodySchema = z.object({
  userId: z.string().min(1).max(128),
  memories: z
    .array(
      z.object({
        id: z.string().min(1).max(256),
        content: z.string().min(1).max(100_000),
        memoryType: z.string().max(64).optional(),
        category: z.string().max(128).optional(),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * POST /memories/search - Semantic memory search
 */
export const memoriesSearchBodySchema = z.object({
  userId: z.string().min(1).max(128),
  query: z.string().min(1).max(4000),
  n_results: z.number().int().min(1).max(100).optional().default(10),
  memoryType: z.string().max(64).optional(),
  category: z.string().max(128).optional(),
});

/**
 * POST /memories/batch-delete - Batch delete memory embeddings
 */
export const memoriesBatchDeleteBodySchema = z.object({
  userId: z.string().min(1).max(128),
  memoryIds: z.array(z.string().min(1).max(256)).min(1).max(100),
});

/**
 * POST /index - Index documents
 */
export const ragIndexBodySchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().min(1).max(256),
        content: z.string().min(1).max(500_000),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(100),
  collection: z.string().max(128).optional(),
});

/**
 * POST /notebook/search
 */
export const notebookSearchBodySchema = z.object({
  query: z.string().min(1).max(4000),
  limit: z.number().int().min(1).max(50).optional().default(5),
  notebookId: z.string().max(128).optional(),
});

/**
 * POST /notebook/ask
 */
export const notebookAskBodySchema = z.object({
  query: z.string().min(1).max(4000),
  notebookId: z.string().max(128).optional(),
  includeContext: z.boolean().optional().default(true),
});
