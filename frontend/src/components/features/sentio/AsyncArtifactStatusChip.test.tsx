import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AsyncArtifactStatusChip,
  normalizeStatusLabel,
} from "./AsyncArtifactStatusChip";

describe("AsyncArtifactStatusChip", () => {
  it("sanitizes caller-provided status labels before rendering", () => {
    render(
      <AsyncArtifactStatusChip
        status="warming"
        labels={{ warming: "Generating\u0000\r\nInjected\u007F" }}
      />,
    );

    const chip = screen.getByText("Generating Injected");
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toBe("Generating Injected");
  });

  it("does not render runtime status values outside the allowlist", () => {
    const { container } = render(
      <AsyncArtifactStatusChip status={"warming\u0000" as "warming"} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("strips OSC and CSI ANSI escape sequences from status labels", () => {
    expect(
      normalizeStatusLabel(
        "\u001b]0;Hidden title\u0007Visible \u001b[31mstatus\u001b[0m\u0000",
      ),
    ).toBe("Visible status");
  });
});
