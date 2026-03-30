import { z } from "zod";
import { apiSuccessEnvelopeSchema } from "./common.js";

export const asyncJobStatusSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  resultRef: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const asyncJobStatusResponseSchema = apiSuccessEnvelopeSchema(
  asyncJobStatusSchema,
);
