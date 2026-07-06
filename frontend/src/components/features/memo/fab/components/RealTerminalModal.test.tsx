import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RealTerminalModal } from "./RealTerminalModal";

const mockUseRealTerminal = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useRealTerminal", () => ({
  useRealTerminal: mockUseRealTerminal,
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    onData: vi.fn(),
    onResize: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: vi.fn(() => ({})),
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

function arrangeTerminalHook(overrides = {}) {
  mockUseRealTerminal.mockReturnValue({
    status: "connected",
    error: null,
    isAvailable: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    resize: vi.fn(),
    ...overrides,
  });
}

describe("RealTerminalModal", () => {
  it("exposes modal, status, terminal region, and labeled actions", () => {
    arrangeTerminalHook();

    render(
      <RealTerminalModal
        isOpen
        onClose={vi.fn()}
        viewportHeight="600px"
        onSwitchToVirtual={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Real Linux terminal" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByRole("status", { name: "Terminal status: Connected" }))
      .toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Reconnect terminal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to virtual shell" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close real terminal" })).toBeInTheDocument();
    expect(screen.getByRole("application", { name: "터미널 세션" })).toBeInTheDocument();
    expect(document.body.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(3);
  });

  it("sanitizes terminal error banners and exposes them as alerts", () => {
    arrangeTerminalHook({
      status: "error",
      error: "\u001b[31mConnection failed\u001b[0m\u0000",
    });

    render(
      <RealTerminalModal
        isOpen
        onClose={vi.fn()}
        viewportHeight="600px"
      />,
    );

    expect(screen.getByRole("alert", { name: "Terminal status: Error" }))
      .toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert", { name: "Terminal error" })).toHaveTextContent(
      "Connection failed",
    );
    expect(document.body.textContent).not.toContain("\u001b");
    expect(document.body.textContent).not.toContain("[31m");
    expect(document.body.textContent).not.toContain("\u0000");
  });

  it("does not render when closed", () => {
    arrangeTerminalHook();

    const { container } = render(
      <RealTerminalModal
        isOpen={false}
        onClose={vi.fn()}
        viewportHeight="600px"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog", { name: "Real Linux terminal" })).not.toBeInTheDocument();
  });
});
