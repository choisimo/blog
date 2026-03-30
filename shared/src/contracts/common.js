import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().optional(),
  errorId: z.string().optional(),
});

export const apiErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: apiErrorSchema,
});

export const paginationMetaSchema = z.object({
  cursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
});

export const apiSuccessEnvelopeSchema = (dataSchema) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    meta: z.record(z.unknown()).optional(),
  });

export const apiPaginatedSuccessEnvelopeSchema = (dataSchema) =>
  apiSuccessEnvelopeSchema(dataSchema).extend({
    cursor: paginationMetaSchema.shape.cursor,
    hasMore: paginationMetaSchema.shape.hasMore,
  });

export const apiEnvelopeSchema = (dataSchema) =>
  z.union([apiSuccessEnvelopeSchema(dataSchema), apiErrorEnvelopeSchema]);

export function unwrapApiEnvelope(payload, dataSchema, fallbackCode = "INVALID_RESPONSE") {
  const parsed = apiEnvelopeSchema(dataSchema).safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: fallbackCode,
        message: "Response payload did not match the shared API envelope.",
      },
    };
  }

  return parsed.data;
}
