/**
 * Zod schemas for /api/v1/execute routes
 * @module middleware/schemas/execute.schema
 */

import { z } from 'zod';

/**
 * POST / - Execute code via Piston
 */
export const executeBodySchema = z.object({
  language: z.string().min(1).max(64),
  version: z.string().max(32).optional(),
  files: z
    .array(
      z.object({
        name: z.string().max(256).optional(),
        content: z.string().max(1_000_000), // 1 MB per file max
      }),
    )
    .min(1)
    .max(10),
  stdin: z.string().max(100_000).optional(),
  args: z.array(z.string().max(1024)).max(20).optional(),
  compile_timeout: z.number().int().min(1000).max(60_000).optional(),
  run_timeout: z.number().int().min(1000).max(60_000).optional(),
});
