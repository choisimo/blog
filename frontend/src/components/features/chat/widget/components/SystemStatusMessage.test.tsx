import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SystemStatusMessage } from "./SystemStatusMessage";

describe("SystemStatusMessage", () => {
  it("exposes sanitized non-terminal status text to assistive technology", () => {
    const { container } = render(
      <SystemStatusMessage
        text={"\u001b[31m연결됨\u001b[0m\u0000"}
        isTerminal={false}
      />,
    );

    const status = screen.getByRole("status", { name: "연결됨" });

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("연결됨")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("keeps terminal divider lines hidden from the accessibility tree", () => {
    const { container } = render(
      <SystemStatusMessage text="터미널 상태" isTerminal />,
    );

    expect(screen.getByRole("status", { name: "터미널 상태" })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
