import { describe, expect, it } from "vitest";
import { buildErrorContactHref } from "@/pages/public/errors/presets";

describe("error page presets", () => {
  it("builds safe contact mailto hrefs", () => {
    expect(buildErrorContactHref(" support@example.com ")).toBe(
      "mailto:support@example.com",
    );
  });

  it("omits unsafe contact mailto hrefs", () => {
    expect(buildErrorContactHref("support@example")).toBeUndefined();
    expect(
      buildErrorContactHref("support@example.com\nbcc:attacker@example.com"),
    ).toBeUndefined();
    expect(buildErrorContactHref("support example@example.com")).toBeUndefined();
    expect(buildErrorContactHref(null)).toBeUndefined();
  });
});
