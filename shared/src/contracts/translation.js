import { z } from "zod";
import { apiSuccessEnvelopeSchema } from "./common.js";

export const translationErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "NOT_READY",
  "NOT_AVAILABLE",
  "AI_TIMEOUT",
  "AI_ERROR",
  "BACKEND_UNAVAILABLE",
  "UNKNOWN",
]);

export const translationLocaleSchema = z.enum(["ko", "en"]);

export const localizedPostFieldsSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string(),
  language: translationLocaleSchema.optional(),
  sourceLanguage: translationLocaleSchema.optional(),
  contentHash: z.string().optional(),
  translatedAt: z.string().optional(),
});

export const translationResultSchema = localizedPostFieldsSchema.extend({
  cached: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  stale: z.boolean().optional(),
  warming: z.boolean().optional(),
});

export const translationQuerySchema = z.object({
  year: z.string().min(1),
  slug: z.string().min(1),
  targetLang: translationLocaleSchema,
});

export const translationGenerateSchema = translationQuerySchema.extend({
  sourceLang: translationLocaleSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  forceRefresh: z.boolean().optional(),
});

export const translationJobStatusSchema = z.object({
  id: z.string(),
  key: z.string().optional(),
  type: z.literal("translation.generate").optional(),
  status: z.enum(["queued", "deferred", "running", "succeeded", "failed"]),
  year: z.string().optional(),
  slug: z.string().optional(),
  targetLang: translationLocaleSchema.optional(),
  sourceLang: translationLocaleSchema.optional(),
  forceRefresh: z.boolean().optional(),
  message: z.string().optional(),
  resultRef: z.string().optional(),
  statusUrl: z.string(),
  cacheUrl: z.string(),
  generateUrl: z.string(),
  contentHash: z.string().optional(),
  attempts: z.number().int().nonnegative().optional(),
  retryAt: z.string().optional(),
  sourceVersion: z.string().optional(),
  error: z
    .object({
      status: z.number().optional(),
      code: z.string().optional(),
      message: z.string(),
      retryable: z.boolean().optional(),
      retryAfterSeconds: z.number().optional(),
    })
    .optional(),
  result: z
    .object({
      source: z.enum(["cache", "generated", "passthrough"]),
      cached: z.boolean(),
      isAiGenerated: z.boolean(),
      translationAvailable: z.boolean(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export const cachedTranslationResponseSchema = apiSuccessEnvelopeSchema(
  translationResultSchema,
);

export const translationGenerateResponseSchema = z.union([
  apiSuccessEnvelopeSchema(translationResultSchema),
  apiSuccessEnvelopeSchema(
    z.object({
      job: translationJobStatusSchema,
      translation: translationResultSchema.optional(),
    }),
  ),
  z.object({
    ok: z.literal(true),
    data: z.null(),
    job: translationJobStatusSchema,
  }),
  z.object({ ok:z.literal(true), data:translationResultSchema.nullable(), job:translationJobStatusSchema }),
]);

export const translationJobResponseSchema = z.union([
  apiSuccessEnvelopeSchema(z.object({job:translationJobStatusSchema})),
  apiSuccessEnvelopeSchema(translationJobStatusSchema),
]);
