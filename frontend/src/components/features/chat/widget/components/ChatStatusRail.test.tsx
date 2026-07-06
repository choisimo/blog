import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatStatusRail } from "./ChatStatusRail";

describe("ChatStatusRail", () => {
  it("exposes sanitized non-error banners as polite status updates", () => {
    const { container } = render(
      <ChatStatusRail
        banner={{
          id: "status-1",
          text: "\u001b[33m재연결 중\u001b[0m\u0000",
          tone: "warn",
        }}
        isTerminal={false}
      />,
    );

    const status = screen.getByRole("status", { name: "재연결 중" });

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("재연결 중")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[33m");
    expect(container.textContent).not.toContain("\u0000");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it("exposes error banners as assertive alerts with sanitized fallback text", () => {
    render(
      <ChatStatusRail
        banner={{
          id: "status-2",
          text: "\u001b[31m\u0000",
          tone: "error",
        }}
        isTerminal
      />,
    );

    const alert = screen.getByRole("alert", { name: "상태 업데이트" });

    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("상태 업데이트");
  });

  it("does not render when no banner is available", () => {
    const { container } = render(
      <ChatStatusRail banner={null} isTerminal={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
