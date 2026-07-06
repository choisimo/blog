import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThoughtCard from "./ThoughtCard";

describe("ThoughtCard", () => {
  it("sanitizes card display fields before rendering", () => {
    render(
      <ThoughtCard
        index={0}
        card={{
          id: "card\u0000/1",
          trackKey: "track_key\u0000\r\nInjected\u007F",
          title: "Title\u0000\r\nInjected\u007F",
          subtitle: "Subtitle\u0000",
          body: "Body\r\nInjected\u007F",
          bullets: ["First\u0000", "Second\r\nInjected\u007F", ""],
          tags: ["Tag\r\nInjected\u007F"],
        }}
      />,
    );

    expect(screen.getByText("track key Injected")).toBeInTheDocument();
    expect(screen.getByText("Title Injected")).toBeInTheDocument();
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
    expect(screen.getByText("Body Injected")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second Injected")).toBeInTheDocument();
    expect(screen.getByText("Tag Injected")).toBeInTheDocument();
  });
});
