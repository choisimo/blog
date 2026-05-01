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

  it("highlights fenced C code without leaking highlighter attributes into text", () => {
    const js = readFileSync(
      resolve(root, "public/ai-memo/ai-memo.js"),
      "utf8",
    );

    document.querySelectorAll("ai-memo-pad").forEach((el) => el.remove());
    if (!customElements.get("ai-memo-pad")) {
      new Function(js)();
    }

    const memo =
      document.querySelector("ai-memo-pad") ??
      document.body.appendChild(document.createElement("ai-memo-pad"));
    const memoElement = memo as HTMLElement & {
      renderMarkdownToPreview: (source: string) => void;
      enhanceCodeBlocks: () => void;
      shadowRoot: ShadowRoot;
    };

    memoElement.renderMarkdownToPreview(
      [
        "```c",
        "#include <stdio.h>",
        "",
        "int main(int argc, char** argv) {",
        '  printf("hell the world");',
        "}",
        "```",
      ].join("\n"),
    );
    memoElement.enhanceCodeBlocks();

    const code = memoElement.shadowRoot.querySelector("#memoPreview pre code");
    expect(code?.textContent).toContain('printf("hell the world");');
    expect(code?.textContent).not.toContain('class="str"');
    expect(code?.querySelector(".str")?.textContent).toBe('"hell the world"');
    expect(code?.querySelector(".fn")?.textContent).toBe("main");
  });
});
