import { forwardRef, type SVGProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DefaultDock } from "./DefaultDock";
import type { DockAction } from "../types";

const TestIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => (
  <svg ref={ref} data-testid="dock-icon" {...props} />
));

const action = (overrides: Partial<DockAction> = {}): DockAction => ({
  key: "chat",
  label: "\u001b[31mAI 채팅\u001b[0m\u0000",
  desktopLabel: "\u001b[32mAI Chat\u001b[0m\u0007",
  icon: TestIcon,
  onClick: vi.fn(),
  ...overrides,
});

describe("DefaultDock", () => {
  it("sanitizes mobile action labels and hides decorative icon and badge", () => {
    const { container } = render(
      <DefaultDock
        dockActions={[action({ badge: true, title: "\u001b[33mOpen chat\u001b[0m" })]}
        isMobile
      />,
    );

    const button = screen.getByRole("button", { name: "AI 채팅" });

    expect(button).toHaveAttribute("title", "Open chat");
    expect(screen.getByText("AI 채팅")).toBeInTheDocument();
    expect(screen.getByTestId("dock-icon")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("sanitizes desktop labels and exposes disabled state", () => {
    render(
      <DefaultDock
        dockActions={[action({ disabled: true, title: "  Stack\nunavailable  " })]}
        isMobile={false}
      />,
    );

    const button = screen.getByRole("button", { name: "AI Chat" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Stack unavailable");
  });

  it("uses sanitized labels for the left icon-only dock", () => {
    render(
      <DefaultDock
        dockActions={[action({ key: "memo", label: "\u001b[35m메모\u001b[0m" })]}
        isMobile={false}
        isLeft
      />,
    );

    expect(screen.getByRole("button", { name: "AI Chat" })).toHaveAttribute(
      "title",
      "AI Chat",
    );
  });
});
