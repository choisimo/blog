import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeDescriptionMarkdown } from "@/components/features/blog/SafeDescriptionMarkdown";

describe("SafeDescriptionMarkdown", () => {
  it("renders formatted markdown without using raw HTML injection", () => {
    render(
      <SafeDescriptionMarkdown
        text={"**Bold** with `code` and [Docs](/docs)"}
      />,
    );

    expect(
      screen.getByText("Bold", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("code", { selector: "code" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/docs",
    );
  });

  it("ignores raw html, removes images, and blocks unsafe links", () => {
    const { container } = render(
      <SafeDescriptionMarkdown
        text={
          'Hello <script>alert("xss")</script> <strong>raw</strong> ![alt](/image.png) <img src="/x.png" alt="raw" /> [bad](//evil.example.com)'
        }
      />,
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container.querySelector("strong")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "bad" })).not.toBeInTheDocument();
    expect(container).toHaveTextContent('Hello alert("xss") raw bad');
  });
});
