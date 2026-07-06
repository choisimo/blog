import type { SVGProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TerminalDock } from "./TerminalDock";
import type { DockAction } from "../types";

const TestIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg data-testid="terminal-dock-icon" {...props} />
);

const action = (overrides: Partial<DockAction> = {}): DockAction => ({
  key: "chat",
  label: "\u001b[31mAI 채팅\u001b[0m\u0000",
  desktopLabel: "\u001b[32mAI Chat\u001b[0m\u0007",
  icon: TestIcon,
  onClick: vi.fn(),
  ...overrides,
});

describe("TerminalDock", () => {
  it("renders nothing for mobile because MobileShellBar owns that surface", () => {
    const { container } = render(
      <TerminalDock dockActions={[action()]} isMobile />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("sanitizes horizontal dock labels and hides decorative terminal chrome", () => {
    const { container } = render(
      <TerminalDock
        dockActions={[action({ badge: true, title: "\u001b[33mOpen chat\u001b[0m" })]}
        isMobile={false}
      />,
    );

    const button = screen.getByRole("button", { name: "AI Chat" });

    expect(button).toHaveAttribute("title", "Open chat");
    expect(screen.getByText("AI Chat")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-dock-icon")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[32m");
    expect(container.textContent).not.toContain("\u0007");
  });

  it("sanitizes left dock labels and exposes disabled state", () => {
    render(
      <TerminalDock
        dockActions={[action({ disabled: true, title: "  Stack\nunavailable  " })]}
        isMobile={false}
        isLeft
      />,
    );

    const button = screen.getByRole("button", { name: "AI Chat" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Stack unavailable");
  });
});
