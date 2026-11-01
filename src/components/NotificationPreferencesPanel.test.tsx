import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import NotificationPreferencesPanel from "./NotificationPreferencesPanel";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      notificationPreferences: vi.fn(),
      updateNotificationPreferences: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const preferences = {
  in_app_enabled: true,
  email_enabled: false,
  email_cadence: "immediate" as const,
  muted_event_types: [] as string[],
};

describe("NotificationPreferencesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.notificationPreferences.mockResolvedValue(preferences);
    mockedApi.updateNotificationPreferences.mockResolvedValue({
      ...preferences,
      email_enabled: true,
    });
  });

  it("loads and renders the channel switches", async () => {
    render(<NotificationPreferencesPanel />);

    expect(await screen.findByLabelText("Show notifications in the app")).toBeChecked();
    expect(screen.getByLabelText("Also email me about important updates")).not.toBeChecked();
    expect(mockedApi.notificationPreferences).toHaveBeenCalled();
  });

  it("saves an email switch change", async () => {
    render(<NotificationPreferencesPanel />);

    await userEvent.click(await screen.findByLabelText("Also email me about important updates"));

    await waitFor(() =>
      expect(mockedApi.updateNotificationPreferences).toHaveBeenCalledWith({
        email_enabled: true,
      }),
    );
    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
  });

  it("saves a mute change", async () => {
    render(<NotificationPreferencesPanel />);

    await userEvent.click(await screen.findByLabelText("Training cancellations"));

    await waitFor(() =>
      expect(mockedApi.updateNotificationPreferences).toHaveBeenCalledWith({
        muted_event_types: ["training.cancelled"],
      }),
    );
  });

  it("surfaces a load failure", async () => {
    mockedApi.notificationPreferences.mockRejectedValue(new Error("boom"));
    render(<NotificationPreferencesPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
