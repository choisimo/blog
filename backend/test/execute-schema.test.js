import test from "node:test";
import assert from "node:assert/strict";

import { executeBodySchema } from "../src/middleware/schemas/execute.schema.js";

function parseExecuteFileName(name) {
  return executeBodySchema.safeParse({
    language: "python",
    files: [{ name, content: "print('ok')" }],
  });
}

test("execute schema accepts basename file names", () => {
  assert.equal(parseExecuteFileName("main.py").success, true);
  assert.equal(parseExecuteFileName("Solution.test.js").success, true);
  assert.equal(parseExecuteFileName("한글.py").success, true);
});

test("execute schema rejects path-like file names", () => {
  for (const name of ["../main.py", "src/main.py", "src\\main.py", ".env"]) {
    const result = parseExecuteFileName(name);
    assert.equal(result.success, false, `${name} should be rejected`);
  }
});
