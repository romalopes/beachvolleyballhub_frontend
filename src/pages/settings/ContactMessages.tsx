import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Search } from "lucide-react";
import {
  api,
  type ContactMessageInbox,
  type ContactMessageStatus,
  type ContactMessageType,
} from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import Pagination from "../../components/settings/Pagination";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import { CONTACT_TYPE_OPTIONS, contactStatusLabel } from "../../constants/contactTypes";
import { formatApiDate } from "../../utils/dateFormatter";

/**
 * Settings → Contact Messages: the internal inbox for public enquiries
 * (IDENTITY-259).
 *
 * Visibility here is a convenience, not a security control: the API authorises
 * every request with ContactMessagePolicy, so a coach/player who reaches this
 * route by URL still receives 403/404 from the server.
 *
 * Message bodies are never listed — only the metadata needed to triage. The
 * detail page shows the body as escaped plain text.
 */

const PER_PAGE = 20;

const STATUS_TABS: { value: ContactMessageStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
];

export default function ContactMessages() {
  const { user } = useAuth();
  const isPlatformStaff = Boolean(
    user?.roles?.some((role) => role === "admin" || role === "curator"),
  );

  const [status, setStatus] = useState<ContactMessageStatus | "all">("all");
  const [contactType, setContactType] = useState<ContactMessageType | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [inbox, setInbox] = useState<ContactMessageInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isPlatformStaff) return;

    let cancelled = false;

    // The loading flag is switched on where a request is *triggered* (see
    // `requestChange` below), never synchronously inside this effect: an effect
    // that immediately sets state causes a cascading render.
    api
      .adminContactMessages({
        status,
        contact_type: contactType,
        search,
        page,
        per_page: PER_PAGE,
      })
      .then((response) => {
        if (cancelled) return;
        setInbox(response);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to load contact messages.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPlatformStaff, status, contactType, search, page, reloadKey]);

  if (!isPlatformStaff) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    requestChange(() => {
      setPage(1);
      setSearch(searchInput.trim());
    });
  };

  const clearFilters = () => {
    requestChange(() => {
      setStatus("all");
      setContactType("");
      setSearchInput("");
      setSearch("");
      setPage(1);
    });
  };

  /**
   * Every filter/page change refetches, so the loading state is switched on at
   * the moment the change is requested (the codebase convention — see Logs.tsx)
   * rather than inside the effect that performs the fetch.
   */
  const requestChange = (change: () => void) => {
    setLoading(true);
    setError(null);
    change();
  };

  const counts = inbox?.counts;
  const messages = inbox?.data ?? [];
  const unreadCount = counts?.unread ?? 0;

  return (
    <SettingsLayout
      title="Contact Messages"
      description="Enquiries submitted through the public Contact form. Reply by email; messages are archived rather than deleted."
      backTo="/settings"
      backLabel="Settings"
      backFallback="/settings"
      actions={
        <span className="contact-unread-pill" aria-live="polite">
          <Mail aria-hidden="true" size={16} />
          {unreadCount} unread
        </span>
      }
    >
      <div className="contact-inbox-toolbar">
        <div className="contact-status-tabs" role="tablist" aria-label="Message status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={`contact-status-tab${status === tab.value ? " active" : ""}`}
              onClick={() =>
                requestChange(() => {
                  setStatus(tab.value);
                  setPage(1);
                })
              }
            >
              {tab.label}
              {counts && (
                <span className="contact-status-tab-count">{counts[tab.value]}</span>
              )}
            </button>
          ))}
        </div>

        <form className="contact-inbox-filters" onSubmit={applySearch} role="search">
          <label className="visually-hidden" htmlFor="contact-search">
            Search messages
          </label>
          <input
            id="contact-search"
            type="search"
            placeholder="Search name, email or subject"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="admin-btn">
            <Search aria-hidden="true" size={15} /> Search
          </button>

          <label className="visually-hidden" htmlFor="contact-type-filter">
            Filter by category
          </label>
          <select
            id="contact-type-filter"
            value={contactType}
            onChange={(event) =>
              requestChange(() => {
                setContactType(event.target.value as ContactMessageType | "");
                setPage(1);
              })
            }
          >
            <option value="">All categories</option>
            {CONTACT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button type="button" className="admin-btn" onClick={clearFilters}>
            Clear
          </button>
        </form>
      </div>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => requestChange(() => setReloadKey((key) => key + 1))}
        />
      ) : loading ? (
        <div className="loading">Loading messages…</div>
      ) : messages.length === 0 ? (
        <EmptyState
          title="No contact messages"
          description={
            search || contactType || status !== "all"
              ? "No messages match these filters."
              : "Messages sent through the public Contact form appear here."
          }
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table contact-inbox-table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">From</th>
                <th scope="col">Category</th>
                <th scope="col">Subject</th>
                <th scope="col">Received</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr
                  key={message.id}
                  className={
                    message.status === "unread" ? "contact-row-unread" : undefined
                  }
                >
                  <td>
                    <span className={`contact-status-badge ${message.status}`}>
                      {contactStatusLabel(message.status)}
                    </span>
                  </td>
                  <td>
                    <span className="contact-sender">{message.name}</span>
                    <span className="contact-sender-email">{message.email}</span>
                  </td>
                  <td>{message.contact_type_label}</td>
                  <td>
                    <Link to={`/settings/contact-messages/${message.id}`}>
                      {message.subject}
                    </Link>
                  </td>
                  <td>{formatApiDate(message.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={inbox?.meta.page ?? 1}
            totalPages={inbox?.meta.total_pages ?? 1}
            totalItems={inbox?.meta.total ?? messages.length}
            itemsPerPage={inbox?.meta.per_page ?? PER_PAGE}
            onPageChange={(next) => requestChange(() => setPage(next))}
          />
        </div>
      )}
    </SettingsLayout>
  );
}
