import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useInputKeyDown } from "@/components/features/chat/widget/hooks/useChatKeyboard";

function Harness({
  canSend = true,
  send,
}: {
  canSend?: boolean;
  send: () => void;
}) {
  const [value, setValue] = useState("");
  const onKeyDown = useInputKeyDown({ canSend, send });

  return (
    <textarea
      aria-label="chat input"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

describe("useInputKeyDown", () => {
  it("sends on plain Enter and prevents textarea newline insertion", async () => {
    const user = userEvent.setup();
    const send = vi.fn();

    render(<Harness send={send} />);

    const input = screen.getByLabelText("chat input");
    await user.type(input, "hello{Enter}");

    expect(send).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("hello");
  });

  it("does not send while IME composition is active", () => {
    const send = vi.fn();

    render(<Harness send={send} />);

    const input = screen.getByLabelText("chat input");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    );

    expect(send).not.toHaveBeenCalled();
  });

  it("does not send when sending is disabled", async () => {
    const user = userEvent.setup();
    const send = vi.fn();

    render(<Harness canSend={false} send={send} />);

    await user.type(screen.getByLabelText("chat input"), "hello{Enter}");

    expect(send).not.toHaveBeenCalled();
  });
});
