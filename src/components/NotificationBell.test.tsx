import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api } from "../api";
import NotificationBell from "./NotificationBell";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      unreadNotificationCount: vi.fn(),
      notifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const user = { id: 1, name: "Player", email_address: "p@x.com", roles: ["player"] };

const notification = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  event_type: "training.cancelled",
  title: "Training cancelled",
  message: "Serve Reception Training has been cancelled.",
  target_path: "/training/1",
  target_label: "Serve Reception Training",
  metadata: {},
  read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  actor: null,
  ...overrides,
});

function renderBell(props: { align?: "left" | "right" } = {}) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <NotificationBell {...props} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.me.mockResolvedValue(user as never);
    mockedApi.unreadNotificationCount.mockResolvedValue({ unread_count: 3 });
    mockedApi.notifications.mockResolvedValue({
      data: [notification()],
      meta: { page: 1, per_page: 8, total: 1, total_pages: 1 },
    });
    mockedApi.markAllNotificationsRead.mockResolvedValue({ marked: 3 });
    mockedApi.markNotificationRead.mockResolvedValue(notification({ read: true }) as never);
  });

  it("shows the unread count on the badge", async () => {
    renderBell();

    expect(
      await screen.findByRole("button", { name: "Notifications, 3 unread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens the dropdown and lists recent notifications", async () => {
    renderBell();
    const trigger = await screen.findByRole("button", { name: "Notifications, 3 unread" });

    await userEvent.click(trigger);

    expect(await screen.findByText("Training cancelled")).toBeInTheDocument();
    expect(mockedApi.notifications).toHaveBeenCalledWith({ per_page: 8 });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("marks all read from the dropdown and clears the badge", async () => {
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    await screen.findByText("Training cancelled");
    // The badge refetches after a read-state change; report zero from then on.
    mockedApi.unreadNotificationCount.mockResolvedValue({ unread_count: 0 });

    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => expect(mockedApi.markAllNotificationsRead).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument(),
    );
  });

  it("opens its panel leftwards by default (header placement)", async () => {
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));

    const dialog = await screen.findByRole("dialog", { name: "Recent notifications" });
    expect(dialog).not.toHaveClass("notification-dropdown--align-left");
  });

  it("opens its panel rightwards when aligned left (sidebar placement)", async () => {
    // The sidebar bell sits near the left of the screen, so its panel must open
    // to the right or it would be clipped off the left edge.
    renderBell({ align: "left" });
    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));

    const dialog = await screen.findByRole("dialog", { name: "Recent notifications" });
    expect(dialog).toHaveClass("notification-dropdown--align-left");
  });

  it("renders nothing when there is no signed-in user", async () => {
    mockedApi.me.mockRejectedValue(new Error("unauthorized"));
    const { container } = renderBell();

    await waitFor(() => expect(container.querySelector(".notification-bell")).toBeNull());
  });
});
