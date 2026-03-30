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
  type: z.literal("translation.generate"),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  message: z.string().optional(),
  resultRef: z.string().optional(),
  statusUrl: z.string().optional(),
  cacheUrl: z.string().optional(),
  generateUrl: z.string().optional(),
  contentHash: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
]);

export const translationJobResponseSchema = apiSuccessEnvelopeSchema(
  translationJobStatusSchema,
);
