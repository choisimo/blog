import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markNotificationReadRemote } from "@/services/realtime/notifications";
import { useNotificationStore, type AppNotification } from "@/stores/realtime/useNotificationStore";
import { NotificationPanel, normalizeNotificationText } from "./NotificationPanel";

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock("@/hooks/ui/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/services/realtime/notifications", () => ({
  markNotificationReadRemote: vi.fn(),
}));

vi.mock("@/stores/realtime/useNotificationStore", () => ({
  useNotificationStore: vi.fn(),
}));

const markNotificationReadRemoteMock = vi.mocked(markNotificationReadRemote);
const useNotificationStoreMock = vi.mocked(useNotificationStore);

const storeActions = {
  markRead: vi.fn(),
  setReadState: vi.fn(),
  markAllRead: vi.fn(),
  removeNotification: vi.fn(),
  clearRead: vi.fn(),
};

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "notification-1",
    type: "info",
    title: "Safe title",
    message: "Safe message",
    createdAt: "2026-07-05T00:00:00.000Z",
    read: false,
    ...overrides,
  } as AppNotification;
}

function mockStore(notifications: AppNotification[]) {
  useNotificationStoreMock.mockReturnValue({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    ...storeActions,
  });
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markNotificationReadRemoteMock.mockResolvedValue(true);
    mockStore([
      notification({
        title: "\u001b[31mDeploy done\u0000",
        message: "\u001b[32mAll good\u0007",
      }),
      notification({
        id: "notification-2",
        title: "Read item",
        read: true,
      }),
    ]);
  });

  it("sanitizes panel labels, notification text, and action labels", () => {
    const { container } = render(
      <NotificationPanel
        label={"\u001b[35mAlerts\u0000"}
        title={"\u001b[34mAlert list\u0007"}
        markReadLabel={"\u001b[31mMark safe\u0000"}
        removeLabel={"\u001b[32mRemove safe\u0000"}
        markAllReadLabel={"\u001b[33mMark all safe\u0000"}
        clearReadLabel={"\u001b[36mClear safe\u0000"}
      />,
    );

    expect(screen.getByRole("region", { name: "Alerts" })).toHaveAttribute(
      "title",
      "Alert list",
    );
    expect(screen.getByText("Deploy done")).toBeInTheDocument();
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark safe" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove safe" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Mark all safe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear safe" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("optimistically marks a notification read and rolls back on remote failure", async () => {
    markNotificationReadRemoteMock.mockResolvedValue(false);
    render(<NotificationPanel markReadLabel="Mark read" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    expect(storeActions.markRead).toHaveBeenCalledWith("notification-1");
    await waitFor(() => {
      expect(storeActions.setReadState).toHaveBeenCalledWith(["notification-1"], false);
    });
    expect(screen.getByText("알림 상태를 서버와 동기화하지 못했습니다.")).toBeInTheDocument();
  });

  it("marks all unread notifications and rolls back failed ids", async () => {
    markNotificationReadRemoteMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockStore([
      notification({ id: "notification-1", title: "First", read: false }),
      notification({ id: "notification-2", title: "Second", read: false }),
    ]);
    render(<NotificationPanel markAllReadLabel="Mark all" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark all" }));

    expect(storeActions.markAllRead).toHaveBeenCalled();
    await waitFor(() => {
      expect(storeActions.setReadState).toHaveBeenCalledWith(["notification-2"], false);
    });
    expect(screen.getByText("일부 알림을 읽음 처리하지 못했습니다.")).toBeInTheDocument();
  });

  it("renders sanitized empty state text", () => {
    mockStore([]);

    render(
      <NotificationPanel
        emptyTitle={"\u001b[31mNo alerts\u0000"}
        emptyDescription={"\u001b[32mNothing pending\u0007"}
      />,
    );

    expect(screen.getByText("No alerts")).toBeInTheDocument();
    expect(screen.getByText("Nothing pending")).toBeInTheDocument();
  });

  it("strips OSC and CSI ANSI escape sequences from notification text", () => {
    expect(
      normalizeNotificationText("\u001b]0;Hidden title\u0007Visible \u001b[31malert\u001b[0m\u0000"),
    ).toBe("Visible alert");
  });
});
