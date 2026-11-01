import { useState } from "react";
import type {
  ApiCheck,
  CheckResult,
} from "../../../services/apiHealth/apiHealthConfig";
import { emitNotificationsChanged } from "../../../services/notificationEvents";
import ResponseInspector from "./ResponseInspector";

// Manual send-test-notification space on the API health page. Mirrors the Rails
// POST /api/v1/health/notifications/test contract: it creates ONE real in-app
// notification for the signed-in admin's own account, so the header bell can be
// seen to update.
//
// The point of the tool is that it is a real delivery: it goes through the same
// publisher (and therefore the same preference check and dedupe key) that
// production events use, rather than writing a row behind the pipeline's back.
export default function NotificationSendSandbox({
  check,
  result,
  running,
  onRun,
}: {
  check: ApiCheck;
  result: CheckResult | undefined;
  running: boolean | undefined;
  onRun: (input: { title: string; message: string }) => Promise<CheckResult>;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const payload = result?.payload as
    | { unread_count?: unknown; reason?: unknown }
    | undefined;
  const unreadCount =
    typeof payload?.unread_count === "number" ? payload.unread_count : null;
  const skippedReason =
    typeof payload?.reason === "string" ? payload.reason : null;

  async function handleSend() {
    setLocalError(null);
    setSending(true);
    try {
      const outcome = await onRun({ title: title.trim(), message: message.trim() });
      // The bell polls on its own, but a diagnostic should be instant: nudge the
      // shared signal so the header refetches its unread count right away.
      if (outcome?.passed) emitNotificationsChanged();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "The request failed to send."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="health-write-sandbox health-notification-sandbox">
      <h3 className="health-write-title">Send Test Notification</h3>
      <p className="health-write-desc">
        {check.description ||
          "Creates one real in-app notification for your account so the header bell updates."}
      </p>

      <label className="health-email-label" htmlFor="health-notification-title">
        Title
      </label>
      <input
        id="health-notification-title"
        className="health-email-input"
        type="text"
        placeholder="Test notification"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={running || sending}
      />

      <label className="health-email-label" htmlFor="health-notification-message">
        Message
      </label>
      <textarea
        id="health-notification-message"
        className="health-email-textarea"
        placeholder="Sent from the API Health page…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={running || sending}
        rows={3}
      />

      <button
        type="button"
        className="admin-btn health-btn"
        disabled={running || sending}
        onClick={() => void handleSend()}
      >
        {sending ? "Sending…" : "Send test notification"}
      </button>

      {localError && (
        <p className="health-email-error" role="alert">
          {localError}
        </p>
      )}

      {result && (
        <div style={{ marginTop: "0.9rem" }}>
          <span
            className={`health-badge ${result.passed ? "health-pass" : "health-fail"}`}
          >
            {result.passed ? "PASS" : "FAIL"}
          </span>
          <span className="health-status-text" style={{ marginLeft: "0.5rem" }}>
            {result.error ||
              (unreadCount != null
                ? `Bell now shows ${unreadCount} unread in ${result.latencyMs}ms`
                : `Completed in ${result.latencyMs}ms`)}
          </span>

          {result.passed && (
            <p className="health-notification-hint" role="status">
              Check the bell in the header — the badge should have moved without a
              reload. Open it to read the notification.
            </p>
          )}

          {!result.passed && skippedReason && (
            <p className="health-notification-hint" role="status">
              Nothing was created: {skippedReason} Re-enable it under Account →
              Notifications and try again.
            </p>
          )}

          <div style={{ marginTop: "0.6rem" }}>
            <ResponseInspector check={check} result={result} />
          </div>
        </div>
      )}
    </div>
  );
}
