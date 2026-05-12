import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ENV = "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";
process.env.FEATURE_ADMIN_AI_IMAGE_ENABLED = "true";
process.env.AI_IMAGE_PROXY_API_KEY = "test-image-key";
process.env.AI_IMAGE_MODEL = "test-image-model";
process.env.AI_IMAGE_MAX_COUNT = "4";

const { createImageGenerationTool } = await import(
  "../src/services/agent/tools/image-generation.tool.js"
);

test("image_generation suggest_prompt builds a prompt without generating images", async () => {
  let generated = false;
  const tool = createImageGenerationTool({
    imageService: {
      async generateImages() {
        generated = true;
      },
    },
    storageService: {
      async saveImages() {
        throw new Error("saveImages should not be called");
      },
    },
  });

  const result = await tool.execute({
    operation: "suggest_prompt",
    title: "Kubernetes release readiness",
    category: "DevOps",
    tags: ["kubernetes", "sre"],
    content: "A checklist for release gates, rollback, monitoring, and alerts.",
  });

  assert.equal(result.success, true);
  assert.equal(result.operation, "suggest_prompt");
  assert.equal(generated, false);
  assert.match(result.prompt, /Kubernetes release readiness/);
  assert.deepEqual(result.actions, []);
});

test("image_generation generate_cover stores images and returns a cover action", async () => {
  const tool = createImageGenerationTool({
    imageService: {
      async generateImages(input, options) {
        assert.match(options.requestId, /test-run/);
        assert.equal(input.n, 1);
        assert.equal(input.outputFormat, "png");
        return {
          model: "test-image-model",
          created: 1770000000,
          durationMs: 42,
          usage: null,
          metadata: null,
          items: [{ buffer: Buffer.from("png"), contentType: "image/png" }],
        };
      },
    },
    storageService: {
      async saveImages(input) {
        assert.equal(input.year, "2026");
        assert.equal(input.slug, "kubernetes-release-readiness");
        assert.equal(input.images.length, 1);
        return {
          dir: "/images/2026/kubernetes-release-readiness/ai",
          items: [
            {
              filename: "generated.png",
              path: "2026/kubernetes-release-readiness/ai/generated.png",
              url: "/images/2026/kubernetes-release-readiness/ai/generated.png",
              variantWebp: {
                url: "/images/2026/kubernetes-release-readiness/ai/generated-w1024.webp",
              },
              alt: input.alt,
              markdown:
                "![Kubernetes release readiness](/images/2026/kubernetes-release-readiness/ai/generated-w1024.webp)",
              source: "ai-generated",
              width: 1024,
              height: 1024,
            },
          ],
        };
      },
    },
  });

  const result = await tool.execute(
    {
      operation: "generate_cover",
      year: "2026",
      slug: "kubernetes-release-readiness",
      prompt: "Create a modern Kubernetes release readiness cover.",
      alt: "Kubernetes release readiness",
    },
    { runId: "test-run" },
  );

  assert.equal(result.success, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "set_cover_image");
  assert.equal(
    result.actions[0].url,
    "/images/2026/kubernetes-release-readiness/ai/generated-w1024.webp",
  );
});

test("image_generation generation operations require year and slug", async () => {
  const tool = createImageGenerationTool();
  const result = await tool.execute({
    operation: "generate_inline",
    prompt: "Create a small technical illustration.",
  });

  assert.equal(result.success, false);
  assert.match(result.error, /year is required/);
});
