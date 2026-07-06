import { describe, expect, it } from "vitest";

import {
  getApiErrorMessage,
  getManifestVarKeys,
  normalizeAdminDisplayText,
  normalizeAdminSelector,
  normalizeSelectorList,
} from "./WorkersManager";

describe("WorkersManager sanitizers", () => {
  it("strips ANSI and control characters from admin display text", () => {
    expect(
      normalizeAdminDisplayText("\u001b[31mWorker\nready\u001b[0m\u0000"),
    ).toBe("Worker ready");
  });

  it("accepts safe selectors and rejects encoded path/header separators", () => {
    expect(normalizeAdminSelector("api-worker_1.prod")).toBe(
      "api-worker_1.prod",
    );
    expect(normalizeAdminSelector("api%2Fworker")).toBeNull();
    expect(normalizeAdminSelector("api\r\nworker")).toBeNull();
  });

  it("deduplicates selector lists while dropping unsafe worker ids", () => {
    expect(
      normalizeSelectorList(["worker-a", "worker-a", "bad/worker", "worker-b"]),
    ).toEqual(["worker-a", "worker-b"]);
  });

  it("returns sanitized API error messages from strings and Error objects", () => {
    expect(
      getApiErrorMessage(
        new Error("\u001b[31mDeploy\nfailed\u001b[0m\u0000"),
        "Fallback",
      ),
    ).toBe("Deploy failed");
    expect(getApiErrorMessage("", "Fallback")).toBe("Fallback");
  });

  it("sanitizes and sorts manifest variable keys before rendering", () => {
    expect(
      getManifestVarKeys({
        "\u001b[32mB_KEY\u001b[0m": "1",
        A_KEY: "2",
        "": "ignored",
      }),
    ).toEqual(["A_KEY", "B_KEY"]);
  });
});
