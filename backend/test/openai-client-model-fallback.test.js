import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ENV = "test";
process.env.AI_DEFAULT_MODEL = "nodove-mspark-1.3c";
process.env.AI_FALLBACK_MODELS = '[]';
process.env.AI_ENABLE_LEGACY_COMPLETIONS_FALLBACK = "false";

const { OpenAICompatClient } = await import(
  "../src/services/ai/openai-client.service.js"
);

async function* createStream(chunks) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

test("mspark synchronous calls use the native non-stream response", async () => {
  const client = new OpenAICompatClient({
    baseUrl: "https://air.example.test/v1",
    apiKey: "sk-test",
    model: "nodove-mspark-1.3c",
  });
  client._openai = { chat: { completions: { create: async payload => {
    assert.equal(payload.model, "nodove-mspark-1.3c");
    assert.equal(payload.stream, false);
    return { model: payload.model, choices: [{ message: { content: "MSPARK_OK" }, finish_reason: "stop" }] };
  } } } };
  const result = await client.chat([{ role: "user", content: "Reply exactly MSPARK_OK" }]);
  assert.equal(result.content, "MSPARK_OK");
  assert.equal(result.model, "nodove-mspark-1.3c");
  assert.equal(result.provider, "openai-compat");
});

test("mspark-only configuration never tries another model after rejection", async () => {
  const client = new OpenAICompatClient({ baseUrl: "https://air.example.test/v1", apiKey: "sk-test" });
  const calls = [];
  const rejected = Object.assign(new Error("Quota unavailable"), { status: 429 });
  client._openai = { chat: { completions: { create: async payload => {
    calls.push(payload.model);
    throw rejected;
  } } } };
  await assert.rejects(client.chat([{ role: "user", content: "test" }]), error => error === rejected);
  assert.deepEqual(calls, ["nodove-mspark-1.3c"]);
  calls.length = 0;
  await assert.rejects(async () => {
    for await (const chunk of client.streamChat([{ role: "user", content: "test" }])) void chunk;
  }, error => error === rejected);
  assert.deepEqual(calls, ["nodove-mspark-1.3c"]);
});

test("chat retries a failed primary request with the configured Zen model", async () => {
  const client = new OpenAICompatClient({
    baseUrl: "https://air.example.test/v1",
    apiKey: "sk-test",
    model: "primary-model",
    fallbackModels: ["deepseek-v4-flash-free"],
  });

  const attemptedModels = [];
  client._openai = {
    chat: {
      completions: {
        create: async (payload) => {
          attemptedModels.push(payload.model);

          if (payload.model === "primary-model") {
            const error = new Error("Primary unavailable");
            error.status = 503;
            throw error;
          }

          return {
            model: payload.model,
            choices: [
              {
                message: { content: "ZEN_OK" },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 4,
              completion_tokens: 2,
              total_tokens: 6,
            },
          };
        },
      },
    },
  };

  const result = await client.chat([
    { role: "user", content: "Reply exactly ZEN_OK" },
  ]);

  assert.deepEqual(attemptedModels, [
    "primary-model",
    "deepseek-v4-flash-free",
  ]);
  assert.equal(result.content, "ZEN_OK");
  assert.equal(result.model, "deepseek-v4-flash-free");
  assert.equal(result.provider, "openai-compat-fallback");
  assert.equal(client.getCircuitState().failures, 0);
});

test("streamChat falls back only before content is emitted", async () => {
  const client = new OpenAICompatClient({
    baseUrl: "https://air.example.test/v1",
    apiKey: "sk-test",
    model: "primary-model",
    fallbackModels: ["deepseek-v4-flash-free"],
  });

  const attemptedModels = [];
  client._openai = {
    chat: {
      completions: {
        create: async (payload) => {
          attemptedModels.push(payload.model);

          if (payload.model === "primary-model") {
            throw new Error("Primary stream unavailable");
          }

          return createStream([
            { choices: [{ delta: { content: "ZEN_" } }] },
            { choices: [{ delta: { content: "STREAM_OK" } }] },
          ]);
        },
      },
    },
  };

  let output = "";
  for await (const chunk of client.streamChat([
    { role: "user", content: "Reply exactly ZEN_STREAM_OK" },
  ])) {
    output += chunk;
  }

  assert.deepEqual(attemptedModels, [
    "primary-model",
    "deepseek-v4-flash-free",
  ]);
  assert.equal(output, "ZEN_STREAM_OK");
  assert.equal(client.getCircuitState().failures, 0);
});
