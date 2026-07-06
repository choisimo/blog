import { describe, expect, it } from "vitest";

import {
  normalizeCodeIDEErrorText,
  normalizeCodeIDEOutputText,
} from "./CodeIDE";

describe("CodeIDE text sanitizers", () => {
  it("strips OSC and CSI ANSI escape sequences from output text", () => {
    expect(
      normalizeCodeIDEOutputText(
        "\u001B]0;Hidden title\u0007Visible \u001B[32moutput\u001B[0m\r\nnext\u0000done",
      ),
    ).toBe("Visible output\nnext done");
  });

  it("strips OSC and CSI ANSI escape sequences from error text", () => {
    expect(
      normalizeCodeIDEErrorText(
        "\u001B]8;;https://hidden.example\u0007Build \u001B[31mfailed\u001B[0m\u0008",
      ),
    ).toBe("Build failed");
  });
});
