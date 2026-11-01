import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api } from "../api";
import Notifications from "./Notifications";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
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
  event_type: "training.rescheduled",
  title: "Training rescheduled",
  message: "Serve Reception Training has a new time.",
  target_path: "/training/1",
  target_label: "Serve Reception Training",
  metadata: {},
  read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  actor: null,
  ...overrides,
});

function page(data: unknown[]) {
  return { data, meta: { page: 1, per_page: 20, total: data.length, total_pages: 1 } };
}

function renderPage(entry = "/notifications") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Notifications />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Notifications page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.me.mockResolvedValue(user as never);
    mockedApi.notifications.mockResolvedValue(page([notification()]) as never);
    mockedApi.markNotificationRead.mockResolvedValue(notification({ read: true }) as never);
    mockedApi.markAllNotificationsRead.mockResolvedValue({ marked: 1 });
  });

  it("lists the account's notifications", async () => {
    renderPage();

    expect(await screen.findByText("Training rescheduled")).toBeInTheDocument();
    expect(screen.getByText("Serve Reception Training has a new time.")).toBeInTheDocument();
    expect(mockedApi.notifications).toHaveBeenCalledWith({
      page: 1,
      per_page: 20,
      unread: false,
    });
  });

  it("shows an empty state when there is nothing to show", async () => {
    mockedApi.notifications.mockResolvedValue(page([]) as never);
    renderPage();

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });

  it("requests only unread notifications when the filter is on", async () => {
    renderPage("/notifications?unread=true");

    await screen.findByText("Training rescheduled");
    expect(mockedApi.notifications).toHaveBeenCalledWith({
      page: 1,
      per_page: 20,
      unread: true,
    });
  });

  it("marks a single notification read", async () => {
    renderPage();
    await screen.findByText("Training rescheduled");

    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));

    await waitFor(() => expect(mockedApi.markNotificationRead).toHaveBeenCalledWith(10));
  });

  it("marks all read", async () => {
    renderPage();
    await screen.findByText("Training rescheduled");

    await userEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));

    await waitFor(() => expect(mockedApi.markAllNotificationsRead).toHaveBeenCalled());
  });
});
