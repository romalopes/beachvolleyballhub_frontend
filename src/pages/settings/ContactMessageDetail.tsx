import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Archive, Mail, MailOpen } from "lucide-react";
import {
  api,
  type ContactMessageDetail as ContactMessage,
  type ContactMessageStatus,
} from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import ErrorState from "../../components/ErrorState";
import { formatApiDate } from "../../utils/dateFormatter";
import { contactStatusLabel } from "../../constants/contactTypes";

/**
 * One contact message (IDENTITY-259).
 *
 * The body is rendered as a React text node inside a `pre-wrap` block — it is
 * never interpreted as HTML (`dangerouslySetInnerHTML` is deliberately absent),
 * so a message containing markup can only ever be read, not executed.
 *
 * Opening the message does not silently change its status: read/unread are
 * explicit, idempotent actions confirmed by the API before the UI updates.
 */
export default function ContactMessageDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isPlatformStaff = Boolean(
    user?.roles?.some((role) => role === "admin" || role === "curator"),
  );

  const [message, setMessage] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isPlatformStaff || !id) return;

    let cancelled = false;

    // Loading is switched on where the request is triggered (initial state and
    // `retry`), never synchronously inside this effect — see Logs.tsx.
    api
      .adminContactMessage(Number(id))
      .then((response) => {
        if (cancelled) return;
        setMessage(response.data);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Failed to load the message.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPlatformStaff, id, reloadKey]);

  if (!isPlatformStaff) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const changeStatus = async (status: ContactMessageStatus) => {
    if (!message || updating) return;

    setUpdating(true);
    setActionError(null);
    try {
      // The server is the source of truth: the UI only shows the new state
      // after the API confirms it.
      const response = await api.adminUpdateContactMessage(message.id, status);
      setMessage(response.data);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Could not update the message. Please try again.",
      );
    } finally {
      setUpdating(false);
    }
  };

  if (error) {
    return (
      <div className="page">
        <SettingsLayout
          title="Contact message"
          backTo="/settings/contact-messages"
          backLabel="Contact Messages"
        >
          <ErrorState
            error={error}
            onRetry={() => {
              setLoading(true);
              setReloadKey((key) => key + 1);
            }}
          />
        </SettingsLayout>
      </div>
    );
  }

  if (loading || !message) {
    return (
      <div className="page">
        <div className="loading">Loading message…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <SettingsLayout
        title={message.subject}
        description="Submitted through the public Contact form."
        backTo="/settings/contact-messages"
        backLabel="Contact Messages"
        actions={
          <span className={`contact-status-badge ${message.status}`}>
            {contactStatusLabel(message.status)}
          </span>
        }
      >
        {actionError && (
          <div className="auth-flash auth-flash-error" role="alert">
            {actionError}
          </div>
        )}

        <dl className="contact-detail-meta">
          <div>
            <dt>From</dt>
            <dd>
              <span className="contact-sender">{message.name}</span>
              <a href={`mailto:${message.email}`} className="contact-reply-link">
                <Mail aria-hidden="true" size={14} /> {message.email}
              </a>
            </dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{message.contact_type_label}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{formatApiDate(message.created_at)}</dd>
          </div>
        </dl>

        {/* Plain text only: whitespace preserved, HTML never interpreted. */}
        <div className="contact-detail-body">{message.message}</div>

        <div className="contact-detail-actions">
          <button
            type="button"
            className="admin-btn"
            onClick={() => changeStatus("read")}
            disabled={updating || message.status === "read"}
          >
            <MailOpen aria-hidden="true" size={15} /> Mark as read
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => changeStatus("unread")}
            disabled={updating || message.status === "unread"}
          >
            <Mail aria-hidden="true" size={15} /> Mark as unread
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => changeStatus("archived")}
            disabled={updating || message.status === "archived"}
          >
            <Archive aria-hidden="true" size={15} /> Archive
          </button>
        </div>

        <p className="contact-detail-note">
          Replying opens your email application. BeachVolleyballHub does not send
          replies from inside the inbox, and messages are archived rather than
          deleted.
        </p>
      </SettingsLayout>
    </div>
  );
}
