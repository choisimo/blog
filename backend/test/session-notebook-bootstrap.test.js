import test from "node:test";
import assert from "node:assert/strict";

process.env.AI_DEFAULT_MODEL ??= "test-model";

const openNotebook = (await import("../src/services/open-notebook.service.js"))
  .default;
const { createSession, ensureSessionNotebook, getSession } = await import(
  "../src/services/session.service.js"
);

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for notebook bootstrap result");
}

test("background notebook bootstrap failures are handled", async () => {
  const original = {
    isEnabled: openNotebook.isEnabled,
    createNotebook: openNotebook.createNotebook,
    createNote: openNotebook.createNote,
  };
  const unhandled = [];
  const onUnhandledRejection = (reason) => {
    unhandled.push(reason);
  };

  process.on("unhandledRejection", onUnhandledRejection);
  openNotebook.isEnabled = () => true;
  openNotebook.createNotebook = async () => ({ id: "notebook-test" });
  openNotebook.createNote = async () => {
    throw new Error("bootstrap unavailable");
  };

  try {
    const sessionId = createSession("notebook bootstrap test");
    const notebookId = await ensureSessionNotebook(sessionId);

    assert.equal(notebookId, "notebook-test");
    await waitFor(
      () => getSession(sessionId)?.notebookError === "bootstrap unavailable",
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    openNotebook.isEnabled = original.isEnabled;
    openNotebook.createNotebook = original.createNotebook;
    openNotebook.createNote = original.createNote;
  }
});
