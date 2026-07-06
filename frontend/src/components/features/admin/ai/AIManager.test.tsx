import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/molecules/AdminSubtabs", () => ({
  AdminSubtabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange?: (id: string) => void;
  }) => (
    <div data-testid="admin-subtabs">
      active:{activeTab}
      <button type="button" onClick={() => onTabChange?.("models")}>
        Models tab
      </button>
      <button type="button" onClick={() => onTabChange?.("models%0Aevil")}>
        Polluted tab
      </button>
    </div>
  ),
}));

vi.mock("./Playground", () => ({
  Playground: () => <div>Playground panel</div>,
}));

vi.mock("./ModelsManager", () => ({
  ModelsManager: () => <div>Models panel</div>,
}));

vi.mock("./ProvidersManager", () => ({
  ProvidersManager: () => <div>Providers panel</div>,
}));

vi.mock("./RoutesManager", () => ({
  RoutesManager: () => <div>Routes panel</div>,
}));

vi.mock("./UsageMonitor", () => ({
  UsageMonitor: () => <div>Monitoring panel</div>,
}));

vi.mock("./TraceViewer", () => ({
  TraceViewer: () => <div>Traces panel</div>,
}));

vi.mock("./PromptsManager", () => ({
  PromptsManager: () => <div>Prompts panel</div>,
}));

import { AIManager } from "./AIManager";

describe("AIManager", () => {
  it("canonicalizes invalid controlled subtabs back to playground", async () => {
    const onSubtabChange = vi.fn();

    render(<AIManager subtab="missing-tab" onSubtabChange={onSubtabChange} />);

    expect(screen.getByTestId("admin-subtabs")).toHaveTextContent(
      "active:playground",
    );
    expect(screen.getByText("Playground panel")).toBeInTheDocument();

    await waitFor(() => {
      expect(onSubtabChange).toHaveBeenCalledWith("playground");
    });
  });

  it("does not emit a subtab change when using the default tab", () => {
    const onSubtabChange = vi.fn();

    render(<AIManager onSubtabChange={onSubtabChange} />);

    expect(screen.getByTestId("admin-subtabs")).toHaveTextContent(
      "active:playground",
    );
    expect(onSubtabChange).not.toHaveBeenCalled();
  });

  it("forwards only allowlisted tab callback values", () => {
    const onSubtabChange = vi.fn();

    render(<AIManager onSubtabChange={onSubtabChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Polluted tab" }));
    expect(onSubtabChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Models tab" }));
    expect(onSubtabChange).toHaveBeenCalledWith("models");
  });
});
