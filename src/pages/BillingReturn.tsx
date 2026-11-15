import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api, type BillingOwnerParams, type BillingStatus } from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";

/**
 * Stripe Checkout return page (IDENTITY-116, Phase 7).
 *
 * A successful browser redirect is *not* proof of payment. This page never grants
 * anything: it polls GET /billing/status, which reports what the signed webhook has
 * already written, and shows a processing state until that happens. `checkout=success`
 * in the URL is treated as a hint only.
 */
const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

export default function BillingReturn() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const outcome = searchParams.get("checkout") === "cancelled" ? "cancelled" : "success";
  const ownerParams: BillingOwnerParams = {
    owner_type: searchParams.get("owner_type") === "organisation" ? "organisation" : "personal",
    owner_id: Number(searchParams.get("owner_id")) || undefined,
  };
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || outcome !== "success") return;
    let cancelled = false;

    const poll = async (remaining: number) => {
      if (cancelled) return;
      try {
        const next = await api.billingStatus(ownerParams);
        if (cancelled) return;
        setStatus(next);
        setAttempts(POLL_ATTEMPTS - remaining + 1);
        if (next.entitled && !next.free_fallback) return;
        if (remaining <= 1) return;
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not check the payment status.");
        }
        return;
      }
      window.setTimeout(() => void poll(remaining - 1), POLL_INTERVAL_MS);
    };

    void poll(POLL_ATTEMPTS);
    return () => {
      cancelled = true;
    };
    // Owner params are derived from the URL; polling once per mount is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, outcome]);

  const confirmed = Boolean(status?.entitled && !status?.free_fallback);
  const pending = outcome === "success" && !confirmed && attempts >= POLL_ATTEMPTS;

  return (
    <div className="page">
      <PageHeader
        title={outcome === "cancelled" ? "Checkout cancelled" : "Confirming your subscription"}
        description={
          outcome === "cancelled"
            ? "No payment was taken. You can choose a plan whenever you are ready."
            : "Stripe has sent us your payment. We are waiting for the confirmation webhook."
        }
      />

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {outcome === "cancelled" && (
        <section className="billing-return-state">
          <XCircle size={40} aria-hidden="true" className="billing-return-icon" />
          <p>Your subscription was not changed.</p>
          <div className="billing-actions">
            <Link className="auth-submit" to="/subscribe">Back to plans</Link>
            <Link className="secondary-button" to="/billing">Billing settings</Link>
          </div>
        </section>
      )}

      {outcome === "success" && !confirmed && !pending && (
        <section className="billing-return-state" aria-live="polite">
          <Clock size={40} aria-hidden="true" className="billing-return-icon spin-slow" />
          <p>Payment received. Activating your plan…</p>
          <p className="billing-return-note">
            This usually takes a few seconds. You can leave this page and the plan will
            still appear under Billing once Stripe confirms it.
          </p>
        </section>
      )}

      {outcome === "success" && pending && (
        <section className="billing-return-state" aria-live="polite">
          <Clock size={40} aria-hidden="true" className="billing-return-icon" />
          <p>Still processing.</p>
          <p className="billing-return-note">
            Stripe has not confirmed the subscription yet. Nothing is lost: check the
            Billing page in a moment, or contact support if the plan does not appear.
          </p>
          <div className="billing-actions">
            <Link className="auth-submit" to="/billing">Check billing status</Link>
          </div>
        </section>
      )}

      {outcome === "success" && confirmed && (
        <section className="billing-return-state" aria-live="polite">
          <CheckCircle2 size={40} aria-hidden="true" className="billing-return-icon" />
          <p>
            You are now on the <strong>{status?.plan?.name}</strong> plan.
          </p>
          <div className="billing-actions">
            <Link className="auth-submit" to="/billing">View billing</Link>
            <Link className="secondary-button" to="/subscribe">See all plans</Link>
          </div>
        </section>
      )}

      {!user && (
        <div className="auth-flash auth-flash-error">
          Please sign in again to see your subscription.
        </div>
      )}
    </div>
  );
}
