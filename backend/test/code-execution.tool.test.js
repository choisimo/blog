import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "code-execution-test-secret";
process.env.FEATURE_CODE_EXECUTION_ENABLED = "true";

const { createCodeExecutionTool } = await import(
  "../src/services/agent/tools/code-execution.tool.js"
);

test("JavaScript execution fails when the sandbox is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("sandbox unavailable");
  };

  try {
    const tool = createCodeExecutionTool();
    const result = await tool.execute({
      language: "javascript",
      code: "return 40 + 2;",
    });

    assert.equal(result.success, false);
    assert.equal(result.language, "javascript");
    assert.match(result.error, /sandbox unavailable/);
    assert.equal(result.result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
