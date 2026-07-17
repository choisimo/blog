import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import requireAdmin from '../middleware/adminAuth.js';
import { ServiceUnavailableError } from '../middleware/errorHandler.js';
import { runIdempotent } from '../lib/idempotency.js';
import { createLogger } from '../lib/logger.js';
import { litellmImageGenerationService } from '../services/ai-image/litellm-image-generation.service.js';
import { generatedImageStorageService } from '../services/ai-image/generated-image-storage.service.js';

const logger = createLogger('admin-ai-images-route');
const router = Router();

const SIZE_OPTIONS = ['1024x1024', '1536x1024', '1024x1536'];
const QUALITY_OPTIONS = ['low', 'medium', 'high', 'auto'];

function buildGenerateSchema() {
  const imageConfig = config.ai?.image || {};
  const maxCount = Math.min(Math.max(Number(imageConfig.maxCount || 1), 1), 4);
  const maxPromptLength = Math.max(Number(imageConfig.maxPromptLength || 4_000), 1);

  return z.object({
    year: z.coerce.string().regex(/^\d{4}$/, 'year must be YYYY'),
    slug: z.string().trim().min(1).max(140),
    prompt: z.string().trim().min(8).max(maxPromptLength),
    n: z.coerce.number().int().min(1).max(maxCount).default(1),
    size: z.enum(SIZE_OPTIONS).default('1024x1024'),
    quality: z.enum(QUALITY_OPTIONS).default('medium'),
    outputFormat: z.enum(['png']).default('png'),
    alt: z.string().trim().max(180).optional(),
  });
}

function requireFeatureEnabled() {
  if (config.features?.adminAiImageEnabled !== true) {
    throw new ServiceUnavailableError('Admin AI image generation is disabled');
  }
}

function buildRequestId(req) {
  const forwarded = req.headers?.['x-request-id'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(value || `admin-ai-image-${Date.now()}`).slice(0, 128);
}

router.get('/health', requireAdmin, async (_req, res, next) => {
  try {
    const data = await litellmImageGenerationService.health();
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
});

router.post('/generate', requireAdmin, async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const input = buildGenerateSchema().parse(req.body || {});
    const requestId = buildRequestId(req);

    return await runIdempotent(
      req,
      res,
      'admin.ai-images.generate',
      input,
      async () => {
        const generation = await litellmImageGenerationService.generateImages(input, {
          requestId,
        });
        const stored = await generatedImageStorageService.saveImages({
          year: input.year,
          slug: input.slug,
          subdir: config.ai?.image?.storageSubdir,
          images: generation.items,
          alt: input.alt || `${input.slug} cover image`,
          requestId,
        });

        logger.info({ requestId }, 'Generated AI images saved', {
          year: input.year,
          slug: input.slug,
          imageCount: stored.items.length,
          dir: stored.dir,
          model: generation.model,
          durationMs: generation.durationMs,
        });

        return {
          statusCode: 201,
          response: {
            ok: true,
            data: {
              dir: stored.dir,
              model: generation.model,
              created: generation.created,
              durationMs: generation.durationMs,
              usage: generation.usage,
              metadata: generation.metadata,
              items: stored.items,
            },
          },
        };
      },
      {
        lockSeconds: Math.ceil((config.ai?.image?.timeoutMs || 300_000) / 1000) + 60,
      },
    );
  } catch (err) {
    return next(err);
  }
});

export default router;
