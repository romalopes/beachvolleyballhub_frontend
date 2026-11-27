import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import BackLink from "../../components/settings/BackLink";
import LocationForm from "../../components/locations/LocationForm";
import LocationMap from "../../components/locations/LocationMap";
import { api, type Location } from "../../api";

export default function LocationEditPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const canOverseeLocations = user?.roles?.some(
    (role) => role === "admin" || role === "curator",
  );

  useEffect(() => {
    if (!slug) return;
    api
      .location(slug)
      .then((loc) => {
        setLocation(loc);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const changeLifecycle = async (
    action: "verify" | "reject" | "archive" | "activate",
  ) => {
    if (!location) return;
    setLifecycleBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await {
        verify: api.verifyLocation,
        reject: api.rejectLocation,
        archive: api.archiveLocation,
        activate: api.activateLocation,
      }[action](location.id);
      setLocation(updated);
      const labels = {
        verify: "verified",
        reject: "rejected",
        archive: "made inactive",
        activate: "activated",
      } as const;
      setSuccess(`Location "${updated.name}" ${labels[action]}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to ${action} location.`);
    } finally {
      setLifecycleBusy(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error && !location) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">{error}</div>
        <BackLink to="/locations" label="Back to locations" />
      </div>
    );
  }
  if (!location) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">Location not found.</div>
        <BackLink to="/locations" label="Back to locations" />
      </div>
    );
  }

  const isOwnerProposal =
    location.proposed_by_account_id === user?.account_id;
  // The BVBH team (admin/curator) can edit any location — the API's update
  // action authorises oversight accounts. A regular user may only edit a
  // location they proposed, and only while it is still unverified.
  const canEditLocation =
    canOverseeLocations ||
    (isOwnerProposal && location.verification_status !== "verified");

  return (
    <div className="page">
      <BackLink to="/locations" label="Back to locations" />
      <h2>Edit Location</h2>
      <p>Update details for "{location.name}".</p>
      {success && (
        <div className="auth-flash auth-flash-success" role="alert">
          {success}
        </div>
      )}
      {error && (
        <div className="auth-flash auth-flash-error" role="alert">
          {error}
        </div>
      )}
      {canOverseeLocations && (
        <section className="detail-section" aria-labelledby="location-lifecycle-heading">
          <h2 id="location-lifecycle-heading">Location status</h2>
          <p>
            Verification:{" "}
            <span className={`status-badge status-${location.verification_status}`}>
              {location.verification_status}
            </span>{" "}
            Lifecycle:{" "}
            <span className={`status-badge status-${location.status}`}>
              {location.status}
            </span>
          </p>
          <div className="admin-table-actions">
            {location.verification_status !== "verified" && (
              <button
                type="button"
                className="admin-btn admin-btn-add"
                disabled={lifecycleBusy}
                onClick={() => void changeLifecycle("verify")}
              >
                Verify
              </button>
            )}
            {location.verification_status !== "rejected" && (
              <button
                type="button"
                className="admin-btn admin-btn-remove"
                disabled={lifecycleBusy}
                onClick={() => void changeLifecycle("reject")}
              >
                Reject
              </button>
            )}
            {location.status === "active" && (
              <button
                type="button"
                className="admin-btn admin-btn-remove"
                disabled={lifecycleBusy}
                onClick={() => void changeLifecycle("archive")}
              >
                Make inactive
              </button>
            )}
            {location.status === "archived" && (
              <button
                type="button"
                className="admin-btn admin-btn-add"
                disabled={lifecycleBusy}
                onClick={() => void changeLifecycle("activate")}
              >
                Activate
              </button>
            )}
          </div>
        </section>
      )}
      {(location.map_url || (location.latitude !== null && location.longitude !== null)) && (
        <section className="detail-section">
          <h3>Map</h3>
          <LocationMap
            name={location.name}
            latitude={location.latitude}
            longitude={location.longitude}
            externalUrl={location.map_url}
          />
        </section>
      )}
      {canEditLocation && (
        <LocationForm
          mode="edit"
          idPrefix="location-edit"
          location={location}
          onUpdated={(updated) => {
            setSuccess(`Location "${updated.name}" updated.`);
            setLocation(updated);
            navigate(`/locations/${updated.slug ?? updated.id}/edit`, { replace: true });
          }}
          onCancel={() => navigate("/locations")}
        />
      )}
      {!canEditLocation && (
        <p>
          You cannot edit this location. Only the proposer can edit an unverified
          proposal, and only admins/curators can manage verified locations.
        </p>
      )}
      <p>
        <a href="/locations">Back to locations</a>
      </p>
    </div>
  );
}