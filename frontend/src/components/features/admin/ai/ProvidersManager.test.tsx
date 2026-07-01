import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersManager } from "./ProvidersManager";
import { useProviders } from "./hooks";

vi.mock("./hooks", () => ({
  useProviders: vi.fn(),
}));

const mockUseProviders = vi.mocked(useProviders);

describe("ProvidersManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProviders.mockReturnValue({
      providers: [],
      loading: false,
      error: "Provider inventory unavailable",
      fetchProviders: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider: vi.fn(),
      checkHealth: vi.fn(),
      killSwitchProvider: vi.fn(),
      enableProvider: vi.fn(),
    });
  });

  it("shows provider load errors without also showing the empty state", () => {
    render(<ProvidersManager />);

    expect(
      screen.getByText("Provider inventory unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No providers configured/i),
    ).not.toBeInTheDocument();
  });
});
