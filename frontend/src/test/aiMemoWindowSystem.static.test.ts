import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("AI Memo window system assets", () => {
  it("keeps the window state contract and command bridge in the web component", () => {
    const js = readFileSync(
      resolve(root, "public/ai-memo/ai-memo.js"),
      "utf8",
    );

    expect(js).toContain("aiMemo.window");
    expect(js).toContain("aiMemo:windowCommand");
    expect(js).toContain("bindWindowInteractions");
    expect(js).toContain("data-resize=\"se\"");
  });

  it("keeps fullscreen, docked, and resize CSS affordances", () => {
    const css = readFileSync(
      resolve(root, "public/ai-memo/ai-memo.css"),
      "utf8",
    );

    expect(css).toContain(":host(.memo-full) .panel");
    expect(css).toContain(".panel.window-docked");
    expect(css).toContain(".resize-handle-se");
    expect(css).toContain(":host(.terminal) .panel");
  });
});
