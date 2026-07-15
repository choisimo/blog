import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, PageErrorBoundary } from "./ErrorBoundary";

vi.mock("@/pages/public/errors/ErrorStatusPage", () => ({
  default: ({
    actions = [],
    footer,
  }: {
    actions?: Array<{ label: string; onClick?: () => void }>;
    footer?: React.ReactNode;
  }) => (
    <div>
      <h1>Server error</h1>
      {actions.map(action => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      {footer}
    </div>
  ),
}));

function ThrowingChild(): never {
  const error = new Error(
    "\u001b]0;Hidden message\u0007\u001b[31mBad\u001b[0m\u0000message"
  );
  error.name = "\u001b]0;Hidden name\u0007\u001b[32mUnsafeError\u001b[0m\u0007";
  error.stack =
    "\u001b]0;Hidden stack\u0007\u001b[33mUnsafe stack\u001b[0m\u0000\nat component";
  throw error;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("sanitizes developer error details before rendering diagnostics", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Server error")).toBeInTheDocument();
    expect(screen.getByText("UnsafeError: Badmessage")).toBeInTheDocument();
    expect(screen.getByText(/Unsafe stack/)).toBeInTheDocument();
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u0000/)).not.toBeInTheDocument();
  });

  it("sanitizes fallback action and developer details labels", () => {
    render(
      <ErrorBoundary
        retryLabel={"\u001b]0;Hidden retry\u0007\u001b[31mRetry now\u0000"}
        homeLabel={"\u001b]0;Hidden home\u0007Go\u0007 home"}
        developerDetailsLabel={"\u001b]0;Hidden debug\u0007\u001b[32mDebug info\u0008"}
      >
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: "Retry now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
    expect(screen.getByText("Debug info")).toBeInTheDocument();
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u0007/)).not.toBeInTheDocument();
  });

  it("sanitizes page error fallback text and preserves retry action", () => {
    render(
      <PageErrorBoundary
        pageErrorTitle={"\u001b]0;Hidden title\u0007\u001b[33mCannot load content\u0000"}
        pageErrorDescription={"\u001b]0;Hidden description\u0007Temporary\u0007 issue"}
        retryLabel={"\u001b]0;Hidden retry\u0007\u001b[34mTry again\u0008"}
      >
        <ThrowingChild />
      </PageErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: "Cannot load content" })).toBeInTheDocument();
    expect(screen.getByText("Temporary issue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u0008/)).not.toBeInTheDocument();
  });
});
