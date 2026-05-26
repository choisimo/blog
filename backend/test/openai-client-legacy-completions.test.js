import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ENV = "test";
process.env.AI_ENABLE_LEGACY_COMPLETIONS_FALLBACK = "true";
process.env.AI_LEGACY_COMPLETIONS_MODEL = "gpt-5-mini";

const { OpenAICompatClient } = await import("../src/services/ai/openai-client.service.js");

test("chat retries through legacy completions when chat completions are unavailable", async () => {
  const client = new OpenAICompatClient({
    baseUrl: "https://air.example.test/v1",
    apiKey: "sk-test",
    model: "gpt-4.1",
  });

  let completionPayload;
  client._openai = {
    chat: {
      completions: {
        create: async () => {
          const error = new Error("Authentication is required.");
          error.status = 401;
          throw error;
        },
      },
    },
    completions: {
      create: async (payload) => {
        completionPayload = payload;
        return {
          choices: [{ text: "OK", finish_reason: "stop" }],
          model: payload.model,
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        };
      },
    },
  };

  const result = await client.chat(
    [
      { role: "system", content: "Answer tersely." },
      { role: "user", content: "Reply with exactly OK" },
    ],
    { temperature: 0, maxTokens: 12 },
  );

  assert.equal(result.content, "OK");
  assert.equal(result.model, "gpt-5-mini");
  assert.equal(result.provider, "openai-compat-legacy-completions");
  assert.equal(completionPayload.model, "gpt-5-mini");
  assert.equal(completionPayload.max_tokens, 12);
  assert.match(completionPayload.prompt, /System: Answer tersely\./);
  assert.match(completionPayload.prompt, /User: Reply with exactly OK/);
});
