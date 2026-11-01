import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCheck, Inbox } from "lucide-react";
import { api, type AppNotification, type PaginationMeta } from "../api";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/settings/Pagination";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { emitNotificationsChanged } from "../services/notificationEvents";

const PER_PAGE = 20;

/**
 * The full notifications inbox: every notification for the signed-in account,
 * newest first, with an unread-only filter and per-row / bulk mark-read.
 *
 * The list is paginated by the API (`{ data, meta }`), so this page mirrors the
 * other paginated screens and reads its page + filter from the URL, keeping the
 * view shareable and back-button friendly.
 */
export default function Notifications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get("unread") === "true";
  const page = Number(searchParams.get("page")) || 1;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped to re-run the fetch after a read action; the effect owns the request
  // so state is only set from the response (matching the other list screens).
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .notifications({ page, per_page: PER_PAGE, unread: unreadOnly })
      .then((response) => {
        if (cancelled) return;
        setItems(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load notifications.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, unreadOnly, refreshKey]);

  const reload = () => {
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  const setUnreadOnly = (next: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("unread", "true");
    else params.delete("unread");
    params.delete("page");
    setLoading(true);
    setSearchParams(params);
  };

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    setLoading(true);
    setSearchParams(params);
  };

  const markRead = async (notification: AppNotification) => {
    setBusy(true);
    try {
      await api.markNotificationRead(notification.id);
      emitNotificationsChanged();
      reload();
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await api.markAllNotificationsRead();
      emitNotificationsChanged();
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        description="Training changes and membership updates addressed to your account."
      />

      <div className="notifications-toolbar">
        <label className="notifications-filter">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          <span>Unread only</span>
        </label>
        <button
          type="button"
          className="notifications-mark-all"
          onClick={() => void markAllRead()}
          disabled={busy}
        >
          <CheckCheck size={16} aria-hidden="true" />
          Mark all as read
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          title="Could not load notifications"
          description={error}
          action={
            <button type="button" className="auth-submit" onClick={reload}>
              Retry
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? "Nothing unread" : "No notifications yet"}
          description={
            unreadOnly
              ? "You are all caught up."
              : "Updates about your trainings and memberships will appear here."
          }
        />
      ) : (
        <>
          <ul className="notification-list">
            {items.map((notification) => (
              <li
                key={notification.id}
                className={`notification-row${notification.read ? "" : " unread"}`}
              >
                <div className="notification-row-body">
                  <div className="notification-row-heading">
                    <Inbox size={16} aria-hidden="true" />
                    <span className="notification-row-title">{notification.title}</span>
                    {!notification.read && <span className="notification-row-badge">Unread</span>}
                  </div>
                  <p className="notification-row-message">{notification.message}</p>
                  <div className="notification-row-meta">
                    <time dateTime={notification.created_at}>
                      {new Date(notification.created_at).toLocaleString()}
                    </time>
                    {notification.target_path && notification.target_label && (
                      <Link to={notification.target_path} className="notification-row-link">
                        {notification.target_label}
                      </Link>
                    )}
                  </div>
                </div>
                {!notification.read && (
                  <button
                    type="button"
                    className="notification-row-action"
                    onClick={() => void markRead(notification)}
                    disabled={busy}
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>

          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.total_pages}
              totalItems={meta.total}
              itemsPerPage={meta.per_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

