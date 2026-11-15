import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, CreditCard, Loader2 } from "lucide-react";
import {
  api,
  type BillingHistoryEntry,
  type BillingOwnerParams,
  type BillingStatus,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import BillingHistoryList from "../components/billing/BillingHistoryList";
import { formatApiDate } from "../utils/dateFormatter";

/**
 * Billing status for one owner (IDENTITY-116, Phase 7).
 *
 * The same component serves personal billing (`/billing`) and club billing
 * (`/organisations/:id/billing`): the difference is the owner context passed to
 * the API, not a second implementation that could drift. Every action is
 * re-authorized by Rails — this page only decides what is worth showing.
 *
 * Nothing here grants access. Cancelling keeps the paid period; upgrading waits
 * for Stripe's confirmation, so the page says "pending" until the API reports the
 * new plan.
 */
export function BillingPanel({
  ownerParams,
  heading,
  description,
}: {
  ownerParams?: BillingOwnerParams;
  heading: string;
  description: string;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const params = ownerParams ?? {};

  const load = useCallback(async () => {
    try {
      const [nextStatus, nextHistory] = await Promise.all([
        api.billingStatus(params),
        api.billingHistory(params),
      ]);
      setStatus(nextStatus);
      setHistory(nextHistory.data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load billing.");
    } finally {
      setLoading(false);
    }
    // `params` is rebuilt each render; its primitive fields are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.owner_type, params.owner_id]);

  useEffect(() => {
    // `load` is asynchronous; the compiler lint cannot see through the callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [user, load]);

  const openPortal = async () => {
    setBusy("portal");
    setError(null);
    setNotice(null);
    try {
      const result = await api.createBillingPortal(params);
      window.location.assign(result.portal_url);
    } catch (e: unknown) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Could not open the billing portal.");
    }
  };

  const change = async (action: "cancel" | "resume") => {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const result = await api.changeSubscription({ action, ...params });
      setNotice(result.message ?? "Your request has been sent to Stripe.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update the subscription.");
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">Please sign in to manage billing.</div>
      </div>
    );
  }
  if (loading) return <div className="loading">Loading billing…</div>;

  return (
    <div className="page">
      <PageHeader title={heading} description={description} />

      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {notice && <div className="auth-flash auth-flash-notice">{notice}</div>}

      {status === null ? (
        <div className="empty-state">Billing information is unavailable.</div>
      ) : (
        <>
          <section className="billing-summary" aria-label="Current subscription">
            <div>
              <p className="billing-eyebrow">Current plan</p>
              <h2>{status.plan?.name ?? "FREE"}</h2>
              <p className="billing-price">{status.plan?.price_label}</p>
            </div>
            <div className="billing-summary-meta">
              <StatusBadge status={status.status} entitled={status.entitled} />
              {status.subscription?.current_period_end && (
                <p>
                  {status.subscription.cancel_at_period_end ? "Access until" : "Renews"}{" "}
                  {formatApiDate(status.subscription.current_period_end)}
                </p>
              )}
              {status.subscription?.grace_period_ends_at && (
                <p className="billing-warning">
                  <AlertCircle size={14} aria-hidden="true" /> Payment failed. Paid
                  access ends {formatApiDate(status.subscription.grace_period_ends_at)}.
                </p>
              )}
              {status.subscription?.pending_change && (
                <p className="billing-pending">
                  Changing to {status.subscription.pending_change.plan.name}
                  {status.subscription.pending_change.effective_at
                    ? ` on ${formatApiDate(status.subscription.pending_change.effective_at)}`
                    : ""}{" "}
                  — awaiting Stripe confirmation.
                </p>
              )}
            </div>
          </section>

          <div className="billing-actions">
            {status.can_checkout && (
              <Link className="auth-submit" to="/subscribe">
                Choose a plan
              </Link>
            )}
            {status.can_change_plan && (
              <Link className="secondary-button" to="/subscribe">
                Change plan
              </Link>
            )}
            {status.can_open_portal && (
              <button
                className="secondary-button"
                type="button"
                onClick={openPortal}
                disabled={busy === "portal"}
              >
                {busy === "portal" ? (
                  <Loader2 size={16} className="spin" aria-hidden="true" />
                ) : (
                  <CreditCard size={16} aria-hidden="true" />
                )}{" "}
                Manage payment method & invoices
              </button>
            )}
            {status.can_change_plan && !status.subscription?.cancel_at_period_end && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => change("cancel")}
                disabled={busy === "cancel"}
              >
                Cancel at period end
              </button>
            )}
            {status.can_change_plan && status.subscription?.cancel_at_period_end && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => change("resume")}
                disabled={busy === "resume"}
              >
                Keep my subscription
              </button>
            )}
          </div>

          <section className="detail-section">
            <h2>What this plan includes</h2>
            <ul className="plan-features">
              {status.features.map((feature) => (
                <li key={feature.slug}>
                  <Check size={16} aria-hidden="true" />
                  <span>{feature.name}</span>
                </li>
              ))}
              {status.features.length === 0 && (
                <li className="plan-feature-empty">
                  The FREE plan does not include paid features.
                </li>
              )}
            </ul>
            <dl className="billing-limits">
              <div>
                <dt>Included users</dt>
                <dd>
                  {status.limits.included_users.label}
                  {status.usage.included_users.usage !== null &&
                    ` · ${status.usage.included_users.usage} in use`}
                </dd>
              </div>
              <div>
                <dt>History retention</dt>
                <dd>{status.limits.history_limit.label}</dd>
              </div>
            </dl>
          </section>

          <BillingHistoryList entries={history} />
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, entitled }: { status: string; entitled: boolean }) {
  const label = status === "free" ? "Free" : status.replace(/_/g, " ");
  return (
    <span className={`billing-status-badge${entitled ? " billing-status-badge--active" : ""}`}>
      {label}
    </span>
  );
}

export default function Billing() {
  return (
    <BillingPanel
      heading="Billing"
      description="Your plan, renewal date, payment method and subscription history."
    />
  );
}
