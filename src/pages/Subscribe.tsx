import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import {
  api,
  type BillingStatus,
  type OrganisationMembership,
  type SubscriptionPlan,
  type User,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";

/**
 * Public pricing page (IDENTITY-116, Phase 7).
 *
 * The catalogue comes from GET /subscriptions: prices, features and limits are
 * never duplicated here. Starting Checkout posts a plan slug — never a price or
 * Stripe Price ID — and the API resolves the amount server-side.
 *
 * Club plans are not sold from this personal page: a Club subscription belongs to
 * an organisation, so those cards link to the billing page of clubs the user
 * actually manages.
 */
export default function Subscribe() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .subscriptions()
      .then((response) => {
        if (active) setPlans(response.data);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load the plans."),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    api
      .billingStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        // A missing billing profile is not an error on a public pricing page.
      });
    return () => {
      active = false;
    };
  }, [user]);

  const managedOrganisations = useMemo(
    () =>
      (user?.organisation_memberships ?? []).filter(
        (membership) =>
          Boolean(membership.organisation) &&
          membership.status === "active" &&
          (membership.role === "owner" || membership.role === "administrator"),
      ),
    [user],
  );

  const startCheckout = async (plan: SubscriptionPlan) => {
    setBusyPlan(plan.slug);
    setError(null);
    setNotice(null);
    try {
      const result = await api.createCheckout({ plan_slug: plan.slug });
      window.location.assign(result.checkout_url);
    } catch (e: unknown) {
      setBusyPlan(null);
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    }
  };

  const changePlan = async (plan: SubscriptionPlan) => {
    setBusyPlan(plan.slug);
    setError(null);
    setNotice(null);
    try {
      const result = await api.changeSubscription({
        action: "change",
        plan_slug: plan.slug,
      });
      setNotice(
        result.message ?? "Your change has been sent to Stripe for confirmation.",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not change the plan.");
    } finally {
      setBusyPlan(null);
    }
  };

  if (loading) return <div className="loading">Loading plans…</div>;

  return (
    <div className="page">
      <PageHeader
        title="Plans & pricing"
        description="Annual plans for players, coaches and clubs. Prices are in Australian dollars and renew yearly."
      />

      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {notice && <div className="auth-flash auth-flash-notice">{notice}</div>}

      <div className="pricing-grid">
        {plans.map((plan) => (
          <PlanCard
            key={plan.slug}
            plan={plan}
            user={user}
            status={status}
            managedOrganisations={managedOrganisations}
            busy={busyPlan === plan.slug}
            onCheckout={startCheckout}
            onChangePlan={changePlan}
          />
        ))}
      </div>

      <p className="pricing-footnote">
        <CreditCard size={14} aria-hidden="true" /> Payments are handled by Stripe.
        BeachVolleyballHub never sees or stores your card details, and a plan activates
        only after Stripe confirms the payment.
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  user,
  status,
  managedOrganisations,
  busy,
  onCheckout,
  onChangePlan,
}: {
  plan: SubscriptionPlan;
  user: User | null;
  status: BillingStatus | null;
  managedOrganisations: OrganisationMembership[];
  busy: boolean;
  onCheckout: (plan: SubscriptionPlan) => Promise<void>;
  onChangePlan: (plan: SubscriptionPlan) => Promise<void>;
}) {
  const isCurrent = status?.plan?.slug === plan.slug;
  const isClubPlan = plan.owner_scope === "organisation";
  const hasPaidSubscription = Boolean(
    status?.subscription && status.subscription.status !== "canceled",
  );

  return (
    <section
      className={`plan-card${plan.popular ? " plan-card--popular" : ""}${isCurrent ? " plan-card--current" : ""}`}
      aria-labelledby={`plan-${plan.slug}-name`}
    >
      <header className="plan-card-header">
        <h2 id={`plan-${plan.slug}-name`}>{plan.name}</h2>
        {plan.popular && (
          <span className="plan-badge">
            <Sparkles size={13} aria-hidden="true" /> Popular
          </span>
        )}
        {isCurrent && <span className="plan-badge plan-badge--current">Current plan</span>}
      </header>

      <p className="plan-price">{plan.price_label}</p>
      {plan.description && <p className="plan-description">{plan.description}</p>}

      <ul className="plan-features">
        {plan.features.map((feature) => (
          <li key={feature.slug}>
            <Check size={16} aria-hidden="true" />
            <span>{feature.name}</span>
          </li>
        ))}
        {plan.features.length === 0 && <li className="plan-feature-empty">No paid features.</li>}
      </ul>

      <dl className="plan-limits">
        <div>
          <dt>Users</dt>
          <dd>{plan.included_users === 0 ? "Owner access only" : plan.included_users ?? "Unlimited"}</dd>
        </div>
        <div>
          <dt>History</dt>
          <dd>{plan.history_limit === 0 ? "No extended history" : plan.history_limit ?? "Unlimited"}</dd>
        </div>
      </dl>

      <PlanAction
        plan={plan}
        user={user}
        isCurrent={isCurrent}
        isClubPlan={isClubPlan}
        hasPaidSubscription={hasPaidSubscription}
        managedOrganisations={managedOrganisations}
        busy={busy}
        onCheckout={onCheckout}
        onChangePlan={onChangePlan}
      />
    </section>
  );
}

function PlanAction({
  plan,
  user,
  isCurrent,
  isClubPlan,
  hasPaidSubscription,
  managedOrganisations,
  busy,
  onCheckout,
  onChangePlan,
}: {
  plan: SubscriptionPlan;
  user: User | null;
  isCurrent: boolean;
  isClubPlan: boolean;
  hasPaidSubscription: boolean;
  managedOrganisations: OrganisationMembership[];
  busy: boolean;
  onCheckout: (plan: SubscriptionPlan) => Promise<void>;
  onChangePlan: (plan: SubscriptionPlan) => Promise<void>;
}) {
  if (plan.default) {
    return <p className="plan-cta-note">Included with every account.</p>;
  }

  if (!user) {
    return (
      <Link className="auth-submit plan-cta" to="/login">
        Sign in to choose {plan.name}
      </Link>
    );
  }

  if (isClubPlan) {
    if (managedOrganisations.length === 0) {
      return (
        <p className="plan-cta-note">
          Club plans are billed to a club. Ask a club owner or administrator to
          subscribe from the club’s billing page.
        </p>
      );
    }
    return (
      <div className="plan-org-links">
        {managedOrganisations.map((membership) =>
          membership.organisation ? (
            <Link
              key={membership.id}
              className="secondary-button plan-cta"
              to={`/organisations/${membership.organisation.id}/billing`}
            >
              Manage {membership.organisation.name} billing
            </Link>
          ) : null,
        )}
      </div>
    );
  }

  if (isCurrent) {
    return <p className="plan-cta-note">This is your current plan.</p>;
  }

  if (busy) {
    return (
      <button className="auth-submit plan-cta" type="button" disabled>
        <Loader2 size={16} className="spin" aria-hidden="true" /> Redirecting…
      </button>
    );
  }

  return (
    <button
      className="auth-submit plan-cta"
      type="button"
      onClick={() => (hasPaidSubscription ? onChangePlan(plan) : onCheckout(plan))}
    >
      {hasPaidSubscription ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
    </button>
  );
}
