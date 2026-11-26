import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { createPortal } from "react-dom";
import { api, type AppNotification } from "../api";
import { useAuth } from "../auth/AuthContext";
import { emitNotificationsChanged, onNotificationsChanged } from "../services/notificationEvents";

// Shared polling state to avoid duplicate API calls between NotificationBell components
let sharedPollTimer: number | null = null;
let pollingDepth = 0;
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
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    // Use shared polling timer to avoid duplicate API calls between NotificationBell components
    if (pollingDepth === 0) {
      sharedPollTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, POLL_INTERVAL_MS);
    }
    pollingDepth++;
    return () => {
      pollingDepth--;
      if (pollingDepth === 0 && sharedPollTimer) {
        window.clearInterval(sharedPollTimer);
        sharedPollTimer = null;
      }
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, location.pathname]);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);
      if (!clickedInsideContainer && !clickedInsideDropdown) {
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

  // Recalculate dropdown position on window resize while open
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const handleResize = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const gap = 8;
      if (align === "left") {
        setDropdownPosition({
          top: rect.bottom + gap,
          left: rect.left,
        });
      } else {
        setDropdownPosition({
          top: rect.bottom + gap,
          right: window.innerWidth - rect.right,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, align]);
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Calculate dropdown position for portal rendering
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const gap = 8; // 0.5rem = 8px

        if (align === "left") {
          // Align left edge of dropdown with left edge of bell
          setDropdownPosition({
            top: rect.bottom + gap,
            left: rect.left,
          });
        } else {
          // Align right edge of dropdown with right edge of bell
          setDropdownPosition({
            top: rect.bottom + gap,
            right: window.innerWidth - rect.right,
          });
        }
      }
      setLoadingRecent(true);
      try {
        const page = await api.notifications({ per_page: 8 });
        setRecent(page.data);
      } catch {
        setRecent([]);
      } finally {
        setLoadingRecent(false);
      }
    } else {
      setDropdownPosition(null);
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
        ref={buttonRef}
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

      {open && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className={`notification-dropdown${align === "left" ? " notification-dropdown--align-left" : ""}`}
          role="dialog"
          aria-label="Recent notifications"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            right: dropdownPosition.right,
            zIndex: 2000,
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}

