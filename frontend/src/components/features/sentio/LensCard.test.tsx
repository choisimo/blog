import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LensCard, { normalizeDisplayText } from "./LensCard";

describe("LensCard", () => {
  it("sanitizes card display fields and falls back for polluted personas", () => {
    render(
      <LensCard
        active
        showEvidence
        card={{
          id: "card\u0000/1",
          personaId: "mentor\u0000" as "mentor",
          angleKey: "angle_key\u0000\r\nInjected\u007F",
          title: "Title\u0000\r\nInjected\u007F",
          summary: "Summary\r\nInjected\u007F",
          bullets: ["First\u0000", "Second\r\nInjected\u007F", ""],
          detail: "Detail\r\nInjected\u007F",
          tags: ["Tag\r\nInjected\u007F"],
        }}
      />,
    );

    expect(screen.getAllByText("Mentor").length).toBeGreaterThan(0);
    expect(screen.getByText("angle_key Injected")).toBeInTheDocument();
    expect(screen.getAllByText("Title Injected").length).toBeGreaterThan(0);
    expect(screen.getByText("Summary Injected")).toBeInTheDocument();
    expect(screen.getAllByText("First").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Second Injected").length).toBeGreaterThan(0);
    expect(screen.getByText("Detail Injected")).toBeInTheDocument();
    expect(screen.getAllByText("Tag Injected").length).toBeGreaterThan(0);
  });

  it("strips OSC and CSI ANSI escape sequences from display text", () => {
    expect(
      normalizeDisplayText(
        "\u001b]0;Hidden title\u0007Visible \u001b[31mlens\u001b[0m\u0000",
      ),
    ).toBe("Visible lens");
  });
});
