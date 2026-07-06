import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockSketch = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock("@/hooks/i18n/useLanguage", () => ({
  default: () => ({ language: "ko" }),
}));

vi.mock("@/services/discovery/ai", () => ({
  sketch: mockSketch,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./PrismDeck", () => ({
  default: () => <div>Prism deck</div>,
}));

vi.mock("./ThoughtFeed", () => ({
  default: () => <div>Thought feed</div>,
}));

import SparkInline, { normalizeDisplayText } from "./SparkInline";

describe("SparkInline", () => {
  it("strips OSC and CSI ANSI escape sequences from display text", () => {
    expect(
      normalizeDisplayText(
        "\u001b]0;Hidden title\u0007Visible \u001b[31mspark\u001b[0m\u0000",
      ),
    ).toBe("Visible spark");
  });

  it("sanitizes sketch metadata and rendered sketch results", async () => {
    mockSketch.mockResolvedValue({
      mood: "\u001b[31m분석적\u001b[0m\u0000\r\nInjected\u007F",
      bullets: ["\u001b[32mFirst\u001b[0m\u0000", "Second\r\nInjected\u007F", ""],
    });

    render(
      <SparkInline postTitle={"Post\u001b[33m\u001b[0m\u0000\r\nInjected\u007F"}>
        {"Paragraph\u001b[34m\u001b[0m\u0000\r\nInjected\u007F"}
      </SparkInline>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI로 문단 분석하기" }));
    fireEvent.click(screen.getByRole("button", { name: /핵심 파악/ }));

    await waitFor(() => {
      expect(mockSketch).toHaveBeenCalledWith({
        paragraph: "Paragraph Injected",
        postTitle: "Post Injected",
      });
    });

    expect(await screen.findByText("분석적 Injected")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second Injected")).toBeInTheDocument();
  });

  it("sanitizes wrapper and trigger accessibility text boundaries", () => {
    const { container } = render(
      <SparkInline
        label={"\u001b[31mSpark wrapper\u0000"}
        title={"Spark\u0007 title"}
        triggerLabel={"\u001b[32mAnalyze text\u0008"}
        triggerTitle={"Open\u0009 AI"}
      >
        {"Paragraph text"}
      </SparkInline>,
    );

    const wrapper = container.querySelector("[data-spark-inline-wrapper]");
    const trigger = screen.getByRole("button", { name: "Analyze text" });

    expect(wrapper).toHaveAttribute("aria-label", "Spark wrapper");
    expect(wrapper).toHaveAttribute("title", "Spark title");
    expect(trigger).toHaveAttribute("title", "Open AI");
    expect(trigger.getAttribute("aria-label")).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u0007");
  });
});
