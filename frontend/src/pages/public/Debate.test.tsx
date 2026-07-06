import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Debate from "./Debate";

const debateRoomMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/features/debate/DebateRoom", () => ({
  default: (props: { topic: unknown; onClose: () => void }) => {
    debateRoomMock(props);
    return <div data-testid="debate-room" />;
  },
}));

function renderDebate(initialEntry = "/debate") {
  debateRoomMock.mockClear();

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/debate" element={<Debate />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Debate page topic boundaries", () => {
  it("sanitizes query topic data before opening the room", () => {
    renderDebate(
      "/debate?topic=%1B%5B31mUnsafe%20topic%1B%5B0m%00&context=Context%1B%5B33m%20line%1B%5B0m%07&mode=chain&intent=%1B%5B32mchain-follow%1B%5B0m%00",
    );

    expect(screen.getByTestId("debate-room")).toBeInTheDocument();
    expect(debateRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: {
          title: "Unsafe topic",
          context: "Context line",
          entryMode: "chain",
          entryIntentId: "chain-follow",
        },
      }),
    );
  });

  it("sanitizes manual title and context before activating the room", () => {
    renderDebate();

    fireEvent.change(screen.getByLabelText("주제"), {
      target: { value: "\u001b[31mManual topic\u001b[0m\u0000" },
    });
    fireEvent.change(screen.getByLabelText("맥락"), {
      target: { value: "Manual\u001b[33m context\u001b[0m\u0007" },
    });
    fireEvent.click(screen.getByRole("button", { name: "상담실 열기" }));

    expect(debateRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: {
          title: "Manual topic",
          context: "Manual context",
          entryMode: "default",
          entryIntentId: undefined,
        },
      }),
    );
  });
});
