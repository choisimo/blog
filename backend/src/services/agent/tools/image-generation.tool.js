/**
 * Agent Image Generation Tool
 *
 * Lets the blog agent turn article context into stored raster image assets.
 * The actual generation and storage invariants are delegated to the existing
 * ai-image services used by the admin image route.
 */

import { z } from "zod";
import { config } from "../../../config.js";
import { createLogger } from "../../../lib/logger.js";
import { litellmImageGenerationService } from "../../ai-image/litellm-image-generation.service.js";
import { generatedImageStorageService } from "../../ai-image/generated-image-storage.service.js";

const logger = createLogger("agent-image-generation");

const OPERATIONS = [
  "suggest_prompt",
  "generate_cover",
  "generate_inline",
  "generate_variants",
  "set_cover_candidate",
];
const SIZE_OPTIONS = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
];
const QUALITY_OPTIONS = ["low", "medium", "high", "auto"];

function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function text(value, maxLength = 1000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => text(tag, 48)).filter(Boolean).slice(0, 12);
  return String(tags || "")
    .split(",")
    .map((tag) => text(tag, 48))
    .filter(Boolean)
    .slice(0, 12);
}

function imageUrl(item) {
  return item?.variantWebp?.url || item?.url || "";
}

function getMaxCount() {
  return Math.min(Math.max(Number(config.ai?.image?.maxCount || 1), 1), 4);
}

function getMaxPromptLength() {
  return Math.max(Number(config.ai?.image?.maxPromptLength || 4000), 1);
}

function buildInputSchema() {
  return z.object({
    operation: z.enum(OPERATIONS).default("suggest_prompt"),
    year: z.coerce.string().regex(/^\d{4}$/).optional(),
    slug: z.string().trim().min(1).max(140).optional(),
    prompt: z.string().trim().max(getMaxPromptLength()).optional(),
    title: z.string().trim().max(240).optional(),
    category: z.string().trim().max(120).optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    content: z.string().trim().max(12_000).optional(),
    visualBrief: z.string().trim().max(1600).optional(),
    style: z.string().trim().max(600).optional(),
    n: z.coerce.number().int().min(1).max(getMaxCount()).optional(),
    size: z.enum(SIZE_OPTIONS).default("1024x1024"),
    quality: z.enum(QUALITY_OPTIONS).default("medium"),
    outputFormat: z.enum(["png"]).default("png"),
    alt: z.string().trim().max(180).optional(),
  });
}

function buildPrompt(input) {
  if (input.prompt?.trim()) return input.prompt.trim().slice(0, getMaxPromptLength());

  const title = text(input.title || input.slug || "Untitled blog post", 180);
  const category = text(input.category || "General", 80);
  const tags = normalizeTags(input.tags);
  const excerpt = text(input.content, 900);
  const visualBrief = text(input.visualBrief, 900);
  const style = text(input.style, 400);

  const intent =
    input.operation === "generate_inline"
      ? "Create a clear inline editorial illustration or conceptual diagram for a technical blog section."
      : "Create a polished editorial cover image for a technical blog post.";

  return [
    intent,
    "Use crisp raster details, a modern tech-blog visual language, balanced composition, no visible text, no logos, and no watermark.",
    style ? `Preferred style: ${style}` : "",
    `Title: ${title}`,
    `Category: ${category}`,
    tags.length ? `Tags: ${tags.join(", ")}` : "",
    visualBrief ? `Visual brief: ${visualBrief}` : "",
    excerpt ? `Article excerpt: ${excerpt}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, getMaxPromptLength());
}

function buildAlt(input) {
  return (
    text(input.alt, 180) ||
    text(input.title, 160) ||
    text(input.slug, 120) ||
    "AI generated blog image"
  );
}

function buildActions(operation, items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  if (operation === "generate_cover" || operation === "set_cover_candidate") {
    const first = items[0];
    const url = imageUrl(first);
    return url
      ? [
          {
            type: "set_cover_image",
            url,
            alt: first.alt,
            image: first,
          },
        ]
      : [];
  }

  if (operation === "generate_inline") {
    return items
      .filter((item) => item?.markdown)
      .map((item) => ({
        type: "insert_markdown",
        markdown: item.markdown,
        url: imageUrl(item),
        alt: item.alt,
        image: item,
      }));
  }

  return [];
}

function validateGenerationTarget(input) {
  if (!input.year || !/^\d{4}$/.test(input.year)) {
    return "year is required for image generation";
  }
  if (!input.slug) {
    return "slug is required for image generation";
  }
  return null;
}

function requireFeatureEnabled() {
  if (config.features?.adminAiImageEnabled !== true) {
    return "AI image generation is disabled";
  }
  return null;
}

function normalizeFailureStatus(value) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function normalizeFailureCode(value, fallback) {
  const candidate = String(value || "");
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(candidate) ? candidate : fallback;
}

function failureMetadata(error, requestId) {
  const upstreamStatus = normalizeFailureStatus(error?.details?.status);
  const gatewayStatus = normalizeFailureStatus(error?.statusCode || error?.status);
  const status = upstreamStatus || gatewayStatus || (error?.name === "ZodError" ? 400 : null);
  const cause = String(error?.details?.cause || "");
  const code = normalizeFailureCode(
    error?.details?.upstreamCode || error?.code,
    error?.name === "ZodError"
      ? "INVALID_IMAGE_GENERATION_INPUT"
      : "IMAGE_GENERATION_FAILED",
  );
  const retryableCauses = new Set([
    "timeout",
    "network",
    "dns",
    "connection_refused",
    "connection_reset",
    "network_timeout",
  ]);

  return {
    code,
    retryable:
      retryableCauses.has(cause) ||
      status === 408 ||
      status === 429 ||
      (status !== null && status >= 500),
    status,
    requestId: text(error?.details?.requestId || requestId, 128),
  };
}

function failureResult({ operation, error, code, status, requestId }) {
  return {
    success: false,
    operation,
    error,
    actions: [],
    code,
    retryable: false,
    status,
    requestId,
  };
}

export function createImageGenerationTool(options = {}) {
  const imageService = options.imageService || litellmImageGenerationService;
  const storageService = options.storageService || generatedImageStorageService;
  const imageTimeoutMs = Math.max(Number(config.ai?.image?.timeoutMs || 300_000), 5_000);

  return {
    name: "image_generation",
    description:
      "Suggest image prompts or generate stored raster images for blog cover, inline, and variant candidates. Generated images are always saved under /images/{year}/{slug}/ai before URLs are returned.",
    timeoutMs: imageTimeoutMs + 30_000,
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: OPERATIONS,
          description:
            "suggest_prompt returns a prompt only. generate_cover stores a cover and returns a set_cover_image action. generate_inline stores inline images and returns insert_markdown actions. generate_variants stores candidates without auto-applying them. set_cover_candidate stores candidates and marks the first as cover.",
        },
        year: {
          type: "string",
          description: "Post year as YYYY. Required for generation operations.",
        },
        slug: {
          type: "string",
          description: "Post slug. Required for generation operations.",
        },
        prompt: {
          type: "string",
          description:
            "Optional final image prompt. If omitted, the tool builds one from title, category, tags, content, visualBrief, and style.",
        },
        title: { type: "string", description: "Post title or section title." },
        category: { type: "string", description: "Post category." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Post tags.",
        },
        content: {
          type: "string",
          description: "Relevant post or paragraph excerpt. Keep it concise.",
        },
        visualBrief: {
          type: "string",
          description: "Visual concept, composition, subject, and constraints.",
        },
        style: {
          type: "string",
          description: "Optional style direction.",
        },
        n: {
          type: "number",
          description: "Number of images to generate. Capped by server configuration.",
          default: 1,
        },
        size: {
          type: "string",
          enum: SIZE_OPTIONS,
          default: "1024x1024",
        },
        quality: {
          type: "string",
          enum: QUALITY_OPTIONS,
          default: "medium",
        },
        alt: {
          type: "string",
          description: "Accessibility alt text for generated images.",
        },
      },
      required: ["operation"],
    },

    async execute(args, executionContext = {}) {
      const requestId =
        executionContext.runId || `agent-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        const input = buildInputSchema().parse(args || {});
        const prompt = buildPrompt(input);
        const alt = buildAlt(input);
        const maxCount = getMaxCount();
        const n =
          input.n ||
          (input.operation === "generate_variants" || input.operation === "set_cover_candidate"
            ? Math.min(3, maxCount)
            : 1);

        if (input.operation === "suggest_prompt") {
          return {
            success: true,
            operation: input.operation,
            prompt,
            alt,
            size: input.size,
            quality: input.quality,
            n: clamp(n, 1, maxCount),
            actions: [],
          };
        }

        const featureError = requireFeatureEnabled();
        if (featureError) {
          return failureResult({
            operation: input.operation,
            error: featureError,
            code: "IMAGE_GENERATION_DISABLED",
            status: 503,
            requestId,
          });
        }

        const targetError = validateGenerationTarget(input);
        if (targetError) {
          return failureResult({
            operation: input.operation,
            error: targetError,
            code: "INVALID_IMAGE_TARGET",
            status: 400,
            requestId,
          });
        }

        if (!prompt || prompt.length < 8) {
          return failureResult({
            operation: input.operation,
            error: "prompt or article context is required for image generation",
            code: "INVALID_IMAGE_PROMPT",
            status: 400,
            requestId,
          });
        }

        logger.info({ requestId }, "Agent image generation requested", {
          operation: input.operation,
          year: input.year,
          slug: input.slug,
          count: clamp(n, 1, maxCount),
          size: input.size,
          quality: input.quality,
        });

        const generation = await imageService.generateImages(
          {
            prompt,
            n: clamp(n, 1, maxCount),
            size: input.size,
            quality: input.quality,
            outputFormat: input.outputFormat,
          },
          { requestId },
        );

        const stored = await storageService.saveImages({
          year: input.year,
          slug: input.slug,
          subdir: config.ai?.image?.storageSubdir,
          images: generation.items,
          alt,
          requestId,
        });
        const actions = buildActions(input.operation, stored.items);

        logger.info({ requestId }, "Agent image generation saved", {
          operation: input.operation,
          year: input.year,
          slug: input.slug,
          imageCount: stored.items.length,
          actionCount: actions.length,
          model: generation.model,
          durationMs: generation.durationMs,
        });

        return {
          success: true,
          operation: input.operation,
          dir: stored.dir,
          model: generation.model,
          created: generation.created,
          durationMs: generation.durationMs,
          usage: generation.usage,
          metadata: generation.metadata,
          prompt,
          alt,
          items: stored.items,
          actions,
        };
      } catch (error) {
        const failure = failureMetadata(error, requestId);
        logger.error({ requestId }, "Agent image generation failed", {
          error: error.message,
          code: failure.code,
          status: failure.status,
          cause: error?.details?.cause || null,
        });
        return {
          success: false,
          operation: args?.operation || "unknown",
          error: error.message,
          actions: [],
          ...failure,
        };
      }
    },
  };
}

export default createImageGenerationTool;
