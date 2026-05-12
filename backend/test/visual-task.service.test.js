import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ENV = "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const {
  buildTaskPrompt,
  getFallbackData,
  isValidTaskMode,
  normalizeTaskData,
  projectTaskDataFromText,
} = await import("../src/services/quiz.service.js");

test("visual task modes are valid and build strict JSON prompts", () => {
  for (const mode of [
    "visual_brief",
    "cover_prompt",
    "diagram_prompt",
    "thumbnail_prompt",
    "alt_text",
  ]) {
    assert.equal(isValidTaskMode(mode), true);
    const built = buildTaskPrompt(mode, {
      postTitle: "Postgres vacuum tuning",
      content: "Explains autovacuum thresholds, bloat, and monitoring.",
    });
    assert.match(built.prompt, /STRICT JSON/);
    assert.equal(typeof built.temperature, "number");
  }
});

test("visual_brief task data is normalized to a stable shape", () => {
  const normalized = normalizeTaskData(
    "visual_brief",
    {
      brief: {
        subject: "Database maintenance",
        goal: "Explain bloat cleanup",
        composition: "Central database cylinder with cleanup flow",
        style: "clean technical editorial",
        palette: ["blue", "green"],
        elements: ["database", "vacuum", "metrics"],
        negative_prompt: "visible text",
      },
      prompt: "Create a clean technical image about Postgres vacuum.",
      altText: "Postgres vacuum maintenance concept",
    },
    { postTitle: "Postgres vacuum tuning" },
  );

  assert.equal(normalized.brief.subject, "Database maintenance");
  assert.equal(normalized.brief.negativePrompt, "visible text");
  assert.deepEqual(normalized.brief.palette, ["blue", "green"]);
  assert.match(normalized.prompt, /Postgres vacuum/);
  assert.equal(normalized.alt, "Postgres vacuum maintenance concept");
});

test("visual prompt fallback and text projection return usable prompt specs", () => {
  const projected = projectTaskDataFromText(
    "cover_prompt",
    "Create a sharp editorial cover with a database focal point.",
    { postTitle: "Postgres vacuum tuning" },
  );
  assert.equal(projected.placement, "cover");
  assert.match(projected.prompt, /database focal point/);

  const fallback = getFallbackData("diagram_prompt", {
    postTitle: "Queue retry design",
    content: "Outbox retry states and dead letter handling.",
  });
  assert.equal(fallback.placement, "inline");
  assert.match(fallback.prompt, /conceptual technical diagram/);
});
