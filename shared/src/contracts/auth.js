import { z } from "zod";
import { apiSuccessEnvelopeSchema } from "./common.js";

export const userSessionFingerprintSchema = z.object({
  visitorId: z.string().min(1),
  advancedVisitorId: z.string().optional(),
  canvasHash: z.string().optional(),
  webglHash: z.string().optional(),
  audioHash: z.string().optional(),
  screenResolution: z.string().optional(),
  osVersion: z.string().optional(),
  fpjsBlocked: z.boolean().optional(),
  components: z.record(z.unknown()).optional(),
});

export const sessionCreateRequestSchema = z.object({
  fingerprint: userSessionFingerprintSchema,
  userAgent: z.string().optional(),
});

export const sessionDataSchema = z.object({
  sessionToken: z.string(),
  fingerprintId: z.string(),
  expiresAt: z.string(),
  firstSeenAt: z.string().optional(),
  visitCount: z.number().optional(),
  isNewUser: z.boolean().optional(),
});

export const sessionResponseSchema = apiSuccessEnvelopeSchema(sessionDataSchema);

export const userPreferenceWriteSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});
