import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, type Organisation } from "../api";
import { BillingPanel } from "./Billing";

/**
 * Organisation (Club) billing (IDENTITY-116, Phase 7).
 *
 * The club is the billable owner, so this route passes an explicit organisation
 * context. Rails verifies the caller is an active owner/administrator of that
 * exact club; a member without billing permission gets a 403 and sees the error,
 * not another club's invoice history.
 */
export default function OrganisationBilling() {
  const { id } = useParams<{ id: string }>();
  const organisationId = Number(id);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(organisationId) || organisationId <= 0) return;
    let active = true;
    api
      .organisation(organisationId)
      .then((record) => {
        if (active) setOrganisation(record);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load the organisation."),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId]);

  if (!Number.isFinite(organisationId) || organisationId <= 0) {
    return <Navigate to="/organisations" replace />;
  }
  if (loading) return <div className="loading">Loading club billing…</div>;

  if (error) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">{error}</div>
        <Link className="secondary-button" to={`/organisations/${organisationId}`}>
          Back to the organisation
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page page--flush">
        <Link className="billing-back-link" to={`/organisations/${organisationId}`}>
          ← {organisation?.name ?? "Organisation"}
        </Link>
      </div>
      <BillingPanel
        ownerParams={{ owner_type: "organisation", owner_id: organisationId }}
        heading={`${organisation?.name ?? "Club"} billing`}
        description="The club's plan, renewal date and subscription history. Only club owners and administrators can see or change this."
      />
    </>
  );
}
