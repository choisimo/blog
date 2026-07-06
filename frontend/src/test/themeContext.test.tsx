import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

function ThemeProbe() {
  const { theme, isTerminal } = useTheme();

  return (
    <div data-testid="theme" data-terminal={String(isTerminal)}>
      {theme}
    </div>
  );
}

const renderThemeProvider = () =>
  render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );

const installLocalStorage = (overrides: Partial<Storage>) => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  const storage = {
    get length() {
      return 0;
    },
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
    ...overrides,
  } as Storage;

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });

  return () => {
    if (original) {
      Object.defineProperty(window, "localStorage", original);
    }
  };
};

describe("ThemeProvider", () => {
  it("uses a valid stored theme", () => {
    window.localStorage.setItem("theme", "dark");

    renderThemeProvider();

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("falls back when reading the stored theme fails", () => {
    const restore = installLocalStorage({
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    });

    try {
      renderThemeProvider();

      expect(screen.getByTestId("theme")).toHaveTextContent("light");
      expect(document.documentElement).toHaveClass("light");
    } finally {
      restore();
    }
  });

  it("keeps rendering when persisting the theme fails", () => {
    const restore = installLocalStorage({
      getItem: vi.fn(() => "terminal"),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    });

    try {
      renderThemeProvider();

      expect(screen.getByTestId("theme")).toHaveTextContent("terminal");
      expect(screen.getByTestId("theme")).toHaveAttribute(
        "data-terminal",
        "true",
      );
      expect(document.documentElement).toHaveClass("dark", "terminal");
    } finally {
      restore();
    }
  });
});
