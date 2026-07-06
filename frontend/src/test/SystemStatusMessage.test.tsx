import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SystemStatusMessage } from "@/components/features/chat/widget/components/SystemStatusMessage";

describe("SystemStatusMessage", () => {
  it("normalizes system status text before rendering", () => {
    render(
      <SystemStatusMessage
        text=" 저장\r\n완료\u0000 "
        isTerminal={false}
      />,
    );

    expect(screen.getByText("저장 완료")).toBeTruthy();
    expect(screen.queryByText(/저장\r?\n완료/)).toBeNull();
  });

  it("renders a fallback for blank system status text", () => {
    render(<SystemStatusMessage text=" \n " isTerminal />);

    expect(screen.getByText("상태 업데이트")).toBeTruthy();
  });
});
