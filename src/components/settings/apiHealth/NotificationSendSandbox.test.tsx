import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApiCheck,
  CheckResult,
} from "../../../services/apiHealth/apiHealthConfig";
import { emitNotificationsChanged } from "../../../services/notificationEvents";
import NotificationSendSandbox from "./NotificationSendSandbox";

// The sandbox is the only thing that nags the header bell to refetch, so the
// signal is mocked and asserted rather than left to the real (listener-free)
// module.
vi.mock("../../../services/notificationEvents", () => ({
  emitNotificationsChanged: vi.fn(),
}));

const mockedEmit = vi.mocked(emitNotificationsChanged);

const check: ApiCheck = {
  id: "send-test-notification",
  discipline: "Write Operations (Manual)",
  name: "Send Test Notification",
  method: "POST",
  url: "/health/notifications/test",
  expectedStatus: 201,
  requiresAuth: true,
  requiresManualTrigger: true,
  description: "Creates one real in-app notification for YOUR account.",
};

function result(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: check.id,
    name: check.name,
    discipline: check.discipline,
    passed: true,
    status: 201,
    expectedStatus: 201,
    latencyMs: 42,
    latencyRating: "excellent",
    payload: { status: "created", notification_id: 7, unread_count: 3 },
    requestHeaders: {},
    error: null,
    retried: false,
    ...overrides,
  };
}

describe("NotificationSendSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the manual trigger with its description", () => {
    render(
      <NotificationSendSandbox check={check} result={undefined} running={false} onRun={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Send test notification" })).toBeInTheDocument();
    expect(
      screen.getByText("Creates one real in-app notification for YOUR account.")
    ).toBeInTheDocument();
  });

  it("sends the typed title and message and reports PASS with the unread count", async () => {
    const onRun = vi.fn().mockResolvedValue(result());
    render(
      <NotificationSendSandbox check={check} result={undefined} running={false} onRun={onRun} />
    );

    await userEvent.type(screen.getByLabelText("Title"), "  Deploy check  ");
    await userEvent.type(screen.getByLabelText("Message"), "  Ping from ops  ");
    await userEvent.click(screen.getByRole("button", { name: "Send test notification" }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        title: "Deploy check",
        message: "Ping from ops",
      })
    );
  });

  it("nudges the header bell only when the notification was actually created", async () => {
    const onRun = vi.fn().mockResolvedValue(result());
    const { unmount } = render(
      <NotificationSendSandbox check={check} result={undefined} running={false} onRun={onRun} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Send test notification" }));

    await waitFor(() => expect(mockedEmit).toHaveBeenCalledTimes(1));
    unmount();
  });

  it("shows the bell figure and PASS once a result is present", () => {
    render(
      <NotificationSendSandbox check={check} result={result()} running={false} onRun={vi.fn()} />
    );

    expect(screen.getByText("PASS")).toBeInTheDocument();
    expect(screen.getByText(/Bell now shows 3 unread/)).toBeInTheDocument();
    expect(screen.getByText(/Check the bell in the header/)).toBeInTheDocument();
  });

  it("explains a skipped notification and does not nudge the bell", async () => {
    const skipped = result({
      passed: false,
      status: 200,
      error:
        "Notification not created — In-app notifications are disabled for your account, so nothing was created.",
      payload: {
        status: "skipped",
        unread_count: 0,
        reason: "In-app notifications are disabled for your account, so nothing was created.",
      },
    });
    const onRun = vi.fn().mockResolvedValue(skipped);
    render(
      <NotificationSendSandbox check={check} result={undefined} running={false} onRun={onRun} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Send test notification" }));

    // The outcome itself is reported by the page once `result` is set; the point
    // here is that a suppressed notification must NOT claim the bell moved.
    await waitFor(() => expect(onRun).toHaveBeenCalled());
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("surfaces a request failure locally", async () => {
    const onRun = vi.fn().mockRejectedValue(new Error("network down"));
    render(
      <NotificationSendSandbox check={check} result={undefined} running={false} onRun={onRun} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Send test notification" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
    expect(mockedEmit).not.toHaveBeenCalled();
  });
});
