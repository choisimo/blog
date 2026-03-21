import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import MarkdownRenderer from "@/components/features/blog/MarkdownRenderer";

function renderMarkdown(content: string, postPath = "2024/proxmox-qdevice-voting-problem-guide") {
  return render(
    <ThemeProvider>
      <MarkdownRenderer content={content} postPath={postPath} />
    </ThemeProvider>,
  );
}

describe("MarkdownRenderer code blocks", () => {
  it("renders fenced shell snippets without an explicit language as full code blocks", () => {
    renderMarkdown("```\npvecm qdevice remove\nrm -rf /etc/corosync/qdevice/\n```");

    expect(screen.getByTestId("code-copy-btn")).toBeInTheDocument();
    expect(screen.getByText(/shell/i)).toBeInTheDocument();
    expect(screen.getByText("pvecm qdevice remove")).toBeInTheDocument();
  });

  it("renders explicit text fences as code blocks with a text label", () => {
    renderMarkdown("```text\nline 1\nline 2\n```");

    expect(screen.getByTestId("code-copy-btn")).toBeInTheDocument();
    expect(screen.getByText(/text/i)).toBeInTheDocument();
    expect(screen.getByText("line 1")).toBeInTheDocument();
  });
});
