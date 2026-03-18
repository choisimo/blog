/**
 * Zod schemas for /api/v1/user routes
 * @module middleware/schemas/user.schema
 */

import { z } from 'zod';

/**
 * POST /session - Create a new user session
 */
export const sessionBodySchema = z.object({
  fingerprint: z.object({
    visitorId: z.string().min(1).max(256),
    advancedVisitorId: z.string().max(256).optional(),
    canvasHash: z.string().max(256).optional(),
    webglHash: z.string().max(256).optional(),
    audioHash: z.string().max(256).optional(),
    screenResolution: z.string().max(64).optional(),
    osVersion: z.string().max(128).optional(),
    components: z.unknown().optional(),
    fpjsBlocked: z.boolean().optional(),
  }),
  userAgent: z.string().max(512).optional(),
});

/**
 * PUT /preferences - Update a preference key-value pair
 */
export const preferencesBodySchema = z.object({
  key: z.string().min(1).max(128),
  value: z.unknown(),
});
