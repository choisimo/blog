import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatStatusRail } from "@/components/features/chat/widget/components/ChatStatusRail";
import type { ChatStatusBanner } from "@/components/features/chat/widget/types";

describe("ChatStatusRail", () => {
  it("normalizes banner text before rendering status messages", () => {
    render(
      <ChatStatusRail
        isTerminal={false}
        banner={
          {
            id: "banner-1",
            tone: "warn",
            text: " 연결\r\n불안정\u0000 ",
          } as ChatStatusBanner
        }
      />,
    );

    expect(screen.getByText("연결 불안정")).toBeTruthy();
    expect(screen.queryByText(/연결\r?\n불안정/)).toBeNull();
  });

  it("renders a fallback for blank banner text", () => {
    render(
      <ChatStatusRail
        isTerminal={false}
        banner={
          {
            id: "banner-2",
            tone: "info",
            text: " \n ",
          } as ChatStatusBanner
        }
      />,
    );

    expect(screen.getByText("상태 업데이트")).toBeTruthy();
  });
});
