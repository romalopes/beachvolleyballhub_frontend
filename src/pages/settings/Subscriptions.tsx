import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  api,
  type AdminBillingDiagnostics,
  type AdminBillingEvent,
  type SubscriptionFeature,
  type SubscriptionPlan,
} from "../../api";
import PageHeader from "../../components/PageHeader";

/**
 * Subscription administration (IDENTITY-116, Phase 7/12).
 *
 * Three catalogues and one audit view, all admin-only:
 *   * plans — price, visibility, order, default flag and feature assignment;
 *   * features — the stable slugs the API enforces;
 *   * manual assignment — a support/migration tool that demands a reason;
 *   * webhook events + configuration diagnostics.
 *
 * Deleting a referenced plan or feature deactivates it instead, so no invoice or
 * history row loses the thing it names. Every manual assignment is written to the
 * subscription history by Rails.
 */
export default function SubscriptionsSettings() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [features, setFeatures] = useState<SubscriptionFeature[]>([]);
  const [events, setEvents] = useState<AdminBillingEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<AdminBillingDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newPlan, setNewPlan] = useState<{
    name: string;
    slug: string;
    yearly_price_cents: number;
    owner_scope: "personal" | "organisation" | "both";
    position: number;
  }>({
    name: "",
    slug: "",
    yearly_price_cents: 0,
    owner_scope: "personal",
    position: 10,
  });
  const [newFeature, setNewFeature] = useState({ name: "", slug: "" });
  const [assignment, setAssignment] = useState({
    owner_type: "Account",
    owner_id: "",
    plan_slug: "",
    reason: "",
  });

  const load = useCallback(async () => {
    try {
      const [plansResponse, featuresResponse, eventsResponse, diagnosticsResponse] =
        await Promise.all([
          api.adminSubscriptions(),
          api.adminSubscriptionFeatures(),
          api.adminBillingEvents({ per_page: 20 }),
          api.adminBillingDiagnostics(),
        ]);
      setPlans(plansResponse.data);
      setFeatures(featuresResponse.data);
      setEvents(eventsResponse.data);
      setDiagnostics(diagnosticsResponse);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load the subscription catalogue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // `load` is asynchronous; the compiler lint cannot see through the callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "The change could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  const createPlan = () =>
    run(
      "new-plan",
      async () => {
        await api.adminCreateSubscription({
          ...newPlan,
          currency: "AUD",
          active: true,
          visible: true,
        });
        setNewPlan({
          name: "",
          slug: "",
          yearly_price_cents: 0,
          owner_scope: "personal",
          position: 10,
        });
      },
      "Plan created.",
    );

  const createFeature = () =>
    run(
      "new-feature",
      async () => {
        await api.adminCreateSubscriptionFeature({ ...newFeature, active: true });
        setNewFeature({ name: "", slug: "" });
      },
      "Feature created.",
    );

  const assign = () => {
    const ownerId = Number(assignment.owner_id);
    if (!ownerId || !assignment.plan_slug || !assignment.reason.trim()) {
      setError("Owner id, plan and reason are required.");
      return undefined;
    }
    return run(
      "assign",
      async () => {
        await api.adminAssignSubscription({
          owner_type: assignment.owner_type as "Account" | "Organisation",
          owner_id: ownerId,
          plan_slug: assignment.plan_slug,
          reason: assignment.reason.trim(),
        });
        setAssignment({ ...assignment, owner_id: "", reason: "" });
      },
      "Plan assigned and audited.",
    );
  };

  if (loading) return <div className="loading">Loading subscription catalogue…</div>;

  return (
    <div className="page">
      <PageHeader
        title="Subscriptions"
        description="Plan and feature catalogue, manual assignments, Stripe configuration and webhook health."
      />

      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {notice && <div className="auth-flash auth-flash-notice">{notice}</div>}

      {diagnostics && (
        <section className="detail-section billing-diagnostics">
          <h2>Stripe configuration</h2>
          <p className={diagnostics.billing.configured ? "" : "billing-warning"}>
            {diagnostics.billing.configured ? (
              "Keys and webhook secret are present on this server."
            ) : (
              <>
                <AlertTriangle size={14} aria-hidden="true" /> Missing:{" "}
                {diagnostics.billing.missing_settings.join(", ") || "unknown"}
              </>
            )}
          </p>
          <ul className="billing-diagnostics-list">
            <li>Enforcement enabled: {diagnostics.billing.enforcement_enabled ? "yes" : "no"}</li>
            <li>Grace period: {diagnostics.billing.grace_period_days} days</li>
            <li>Billing records: {diagnostics.counts.billing_subscriptions}</li>
            <li>Webhook events: {diagnostics.counts.billing_events}</li>
            <li>Failed events: {diagnostics.counts.failed_events}</li>
            <li>Open checkout sessions: {diagnostics.counts.open_checkout_sessions}</li>
          </ul>
          <table className="admin-billing-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Price configured</th>
                <th scope="col">Source</th>
                <th scope="col">Active</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.billing.plans.map((plan) => (
                <tr key={plan.slug}>
                  <td>{plan.slug}</td>
                  <td>{plan.price_configured ? "yes" : "no"}</td>
                  <td>{plan.price_source ?? "—"}</td>
                  <td>{plan.active ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="detail-section">
        <div className="section-heading-row">
          <h2>Plans</h2>
          <button className="secondary-button" type="button" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        </div>
        <div className="admin-subscription-list">
          {plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              features={features}
              busy={busy}
              run={run}
            />
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2>Add a plan</h2>
        <form
          className="admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createPlan();
          }}
        >
          <label>
            Name
            <input
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              required
            />
          </label>
          <label>
            Slug
            <input
              value={newPlan.slug}
              onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })}
              placeholder="academy"
            />
          </label>
          <label>
            Annual cents
            <input
              type="number"
              min={0}
              value={newPlan.yearly_price_cents}
              onChange={(e) =>
                setNewPlan({ ...newPlan, yearly_price_cents: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Owner scope
            <select
              value={newPlan.owner_scope}
              onChange={(e) =>
                setNewPlan({
                  ...newPlan,
                  owner_scope: e.target.value as "personal" | "organisation" | "both",
                })
              }
            >
              <option value="personal">Personal</option>
              <option value="organisation">Organisation</option>
              <option value="both">Both</option>
            </select>
          </label>
          <button className="auth-submit" type="submit" disabled={busy === "new-plan"}>
            {busy === "new-plan" ? (
              <Loader2 size={16} className="spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}{" "}
            Create plan
          </button>
        </form>
      </section>

      <section className="detail-section">
        <h2>Features</h2>
        <div className="admin-subscription-list">
          {features.map((feature) => (
            <FeatureRow key={feature.id} feature={feature} busy={busy} run={run} />
          ))}
        </div>
        <form
          className="admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createFeature();
          }}
        >
          <label>
            Name
            <input
              value={newFeature.name}
              onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
              required
            />
          </label>
          <label>
            Slug
            <input
              value={newFeature.slug}
              onChange={(e) => setNewFeature({ ...newFeature, slug: e.target.value })}
              placeholder="advanced_planning"
            />
          </label>
          <button className="auth-submit" type="submit" disabled={busy === "new-feature"}>
            <Plus size={16} aria-hidden="true" /> Add feature
          </button>
        </form>
      </section>

      <section className="detail-section">
        <h2>Manual plan assignment</h2>
        <p className="billing-return-note">
          For support and migrations. A reason is mandatory and is written to the
          subscription history. Subscriptions managed by Stripe must be changed in
          Stripe instead.
        </p>
        <form
          className="admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void assign();
          }}
        >
          <label>
            Owner type
            <select
              value={assignment.owner_type}
              onChange={(e) => setAssignment({ ...assignment, owner_type: e.target.value })}
            >
              <option value="Account">Account</option>
              <option value="Organisation">Organisation</option>
            </select>
          </label>
          <label>
            Owner id
            <input
              type="number"
              min={1}
              value={assignment.owner_id}
              onChange={(e) => setAssignment({ ...assignment, owner_id: e.target.value })}
              required
            />
          </label>
          <label>
            Plan
            <select
              value={assignment.plan_slug}
              onChange={(e) => setAssignment({ ...assignment, plan_slug: e.target.value })}
              required
            >
              <option value="">Select a plan…</option>
              {plans.map((plan) => (
                <option key={plan.slug} value={plan.slug}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-inline-form-wide">
            Reason
            <input
              value={assignment.reason}
              onChange={(e) => setAssignment({ ...assignment, reason: e.target.value })}
              placeholder="Support ticket reference or migration note"
              required
            />
          </label>
          <button className="auth-submit" type="submit" disabled={busy === "assign"}>
            Assign plan
          </button>
        </form>
      </section>

      <section className="detail-section">
        <h2>Recent webhook events</h2>
        {events.length === 0 ? (
          <p className="empty-state">No webhook events have been received yet.</p>
        ) : (
          <div className="billing-history-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.created_at).toLocaleString()}</td>
                    <td>{event.event_type}</td>
                    <td>{event.status}</td>
                    <td>{event.attempts}</td>
                    <td>{event.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PlanRow({
  plan,
  features,
  busy,
  run,
}: {
  plan: SubscriptionPlan;
  features: SubscriptionFeature[];
  busy: string | null;
  run: (key: string, action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    yearly_price_cents: plan.yearly_price_cents,
    position: plan.position,
    active: plan.active,
    visible: plan.visible,
    popular: plan.popular,
  });
  const [selected, setSelected] = useState<number[]>(plan.features.map((feature) => feature.id));

  useEffect(() => {
    // Sync the editable draft when the server returns a refreshed plan.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      yearly_price_cents: plan.yearly_price_cents,
      position: plan.position,
      active: plan.active,
      visible: plan.visible,
      popular: plan.popular,
    });
    setSelected(plan.features.map((feature) => feature.id));
  }, [plan]);

  const key = `plan-${plan.id}`;
  const toggle = (featureId: number) =>
    setSelected((previous) =>
      previous.includes(featureId)
        ? previous.filter((id) => id !== featureId)
        : [...previous, featureId],
    );

  return (
    <article className="admin-subscription-row">
      <header className="admin-subscription-row-head">
        <strong>{plan.name}</strong>
        <code>{plan.slug}</code>
        {plan.default && <span className="plan-badge">Default</span>}
        {!plan.active && <span className="plan-badge">Inactive</span>}
        <span className="admin-subscription-price">{plan.price_label}</span>
      </header>

      <div className="admin-inline-form">
        <label>
          Annual cents
          <input
            type="number"
            min={0}
            value={draft.yearly_price_cents}
            onChange={(e) =>
              setDraft({ ...draft, yearly_price_cents: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Position
          <input
            type="number"
            min={0}
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })}
          />
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Active
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={draft.visible}
            onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
          />
          Visible
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={draft.popular}
            onChange={(e) => setDraft({ ...draft, popular: e.target.checked })}
          />
          Popular
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={busy === `${key}:save`}
          onClick={() =>
            void run(
              `${key}:save`,
              async () => {
                await api.adminUpdateSubscription(plan.id, draft);
              },
              "Plan updated.",
            )
          }
        >
          Save
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={busy === `${key}:delete`}
          onClick={() =>
            void run(
              `${key}:delete`,
              async () => {
                await api.adminDeleteSubscription(plan.id);
              },
              "Plan deleted or deactivated.",
            )
          }
        >
          <Trash2 size={14} aria-hidden="true" /> Delete
        </button>
      </div>

      <fieldset className="admin-feature-picker">
        <legend>Features</legend>
        <div className="admin-feature-options">
          {features.map((feature) => (
            <label key={feature.id} className="admin-checkbox">
              <input
                type="checkbox"
                checked={selected.includes(feature.id)}
                onChange={() => toggle(feature.id)}
              />
              {feature.name}
              {!feature.active ? " (inactive)" : ""}
            </label>
          ))}
        </div>
        <button
          className="auth-submit"
          type="button"
          disabled={busy === `${key}:features`}
          onClick={() =>
            void run(
              `${key}:features`,
              async () => {
                await api.adminSetSubscriptionFeatures(plan.id, selected);
              },
              "Plan features saved.",
            )
          }
        >
          Save features
        </button>
      </fieldset>
    </article>
  );
}

function FeatureRow({
  feature,
  busy,
  run,
}: {
  feature: SubscriptionFeature;
  busy: string | null;
  run: (key: string, action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: feature.name,
    position: feature.position,
    active: feature.active,
  });

  useEffect(() => {
    // Sync the draft when the server returns a refreshed feature.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ name: feature.name, position: feature.position, active: feature.active });
  }, [feature]);

  const key = `feature-${feature.id}`;

  return (
    <article className="admin-subscription-row">
      <header className="admin-subscription-row-head">
        <strong>{feature.name}</strong>
        <code>{feature.slug}</code>
        {!feature.active && <span className="plan-badge">Inactive</span>}
      </header>
      <div className="admin-inline-form">
        <label>
          Name
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Position
          <input
            type="number"
            min={0}
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })}
          />
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Active
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={busy === `${key}:save`}
          onClick={() =>
            void run(
              `${key}:save`,
              async () => {
                await api.adminUpdateSubscriptionFeature(feature.id, draft);
              },
              "Feature updated.",
            )
          }
        >
          Save
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={busy === `${key}:delete`}
          onClick={() =>
            void run(
              `${key}:delete`,
              async () => {
                await api.adminDeleteSubscriptionFeature(feature.id);
              },
              "Feature deleted or deactivated.",
            )
          }
        >
          <Trash2 size={14} aria-hidden="true" /> Delete
        </button>
      </div>
    </article>
  );
}
