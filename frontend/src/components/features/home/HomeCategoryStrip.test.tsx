import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomeCategoryStrip } from "./HomeCategoryStrip";

describe("HomeCategoryStrip", () => {
  it("sanitizes category labels and filters unsafe category links", () => {
    render(
      <MemoryRouter>
        <HomeCategoryStrip
          state="ready"
          isTerminal={false}
          categories={[
            { name: "AI\u0000\r\nTools\u007F", count: 3.8 },
            { name: "bad/slash", count: 2 },
            { name: "\u0000", count: 1 },
          ] as any}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("AI Tools")).toBeInTheDocument();
    expect(screen.getByText("3 Posts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /AI Tools/i })).toHaveAttribute(
      "href",
      "/blog?category=AI%20Tools",
    );
    expect(screen.queryByText("bad/slash")).not.toBeInTheDocument();
  });
});
