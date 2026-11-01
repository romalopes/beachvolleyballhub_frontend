import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { api, type AppNotification } from "../api";
import { useAuth } from "../auth/AuthContext";
import { emitNotificationsChanged, onNotificationsChanged } from "../services/notificationEvents";

// How often the badge refreshes while the tab is visible. Foreground polling is
// the deliberate first-release choice (no WebSockets/Redis); the plan's 30–60s
// band is honoured and paused when the tab is hidden.
const POLL_INTERVAL_MS = 45_000;

/**
 * Header bell: an unread badge plus a recent-notifications dropdown.
 *
 * It reads the dedicated `unread_count` endpoint (a single COUNT) rather than the
 * paginated list, and refetches on route change, window focus, tab visibility and
 * the app-level read-state signal. Every failure falls back to zero unread so a
 * missing session can never break the header.
 */
export default function NotificationBell({
  collapsed = false,
  align = "right",
}: {
  collapsed?: boolean;
  /**
   * Which edge of the bell the dropdown lines up with. The sidebar bell sits at
   * the LEFT of the screen, so its panel must open rightwards (`"left"`);
   * the mobile-header bell sits at the right, so it opens leftwards (`"right"`,
   * the default). Getting this wrong pushes the panel off the opposite edge.
   */
  align?: "left" | "right";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<AppNotification[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Badge: refetch on route change, focus, visibility and read-state changes,
  // and poll only while the tab is visible. State is set only from the response
  // (never synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!user) return;
      api
        .unreadNotificationCount()
        .then((data) => {
          if (!cancelled) setUnread(data.unread_count ?? 0);
        })
        .catch(() => {
          if (!cancelled) setUnread(0);
        });
    };
    refresh();
    const unsubscribe = onNotificationsChanged(refresh);
    const onFocus = refresh;
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [user, location.pathname]);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || !user) return;
    setLoadingRecent(true);
    try {
      const page = await api.notifications({ per_page: 8 });
      setRecent(page.data);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await api.markAllNotificationsRead();
      setRecent((rows) => rows.map((row) => ({ ...row, read: true })));
      setUnread(0);
      emitNotificationsChanged();
    } finally {
      setBusy(false);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    setOpen(false);
    if (!notification.read) {
      try {
        await api.markNotificationRead(notification.id);
        emitNotificationsChanged();
      } catch {
        // The destination matters more than the read state; navigate regardless.
      }
    }
    if (notification.target_path) navigate(notification.target_path);
  };

  if (!user) return null;

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        title={collapsed ? "Notifications" : undefined}
        onClick={() => void toggle()}
      >
        <Bell aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-bell-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`notification-dropdown${align === "left" ? " notification-dropdown--align-left" : ""}`}
          role="dialog"
          aria-label="Recent notifications"
        >
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className="notification-dropdown-mark-all"
                onClick={() => void markAllRead()}
                disabled={busy}
              >
                Mark all read
              </button>
            )}
          </div>

          {loadingRecent ? (
            <p className="notification-dropdown-status">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="notification-dropdown-status">You have no notifications.</p>
          ) : (
            <ul className="notification-dropdown-list">
              {recent.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notification-dropdown-item${notification.read ? "" : " unread"}`}
                    onClick={() => void openNotification(notification)}
                  >
                    <span className="notification-dropdown-title">{notification.title}</span>
                    <span className="notification-dropdown-message">{notification.message}</span>
                    <span className="notification-dropdown-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/notifications"
            className="notification-dropdown-footer"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

