import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import LocationEditForm from "../../components/locations/LocationEditForm";
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
    if (!canOverseeLocations) return;
    if (!slug) return;
    api
      .location(slug)
      .then((loc) => {
        setLocation(loc);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [canOverseeLocations, slug]);

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

  if (!canOverseeLocations) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error && !location) {
    return (
      <SettingsLayout title="Edit Location" backTo="/settings/locations" backLabel="Back to Locations">
        <div className="auth-flash auth-flash-error">{error}</div>
      </SettingsLayout>
    );
  }
  if (!location) {
    return (
      <SettingsLayout title="Edit Location" backTo="/settings/locations" backLabel="Back to Locations">
        <div className="auth-flash auth-flash-error">Location not found.</div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      title="Edit Location"
      description={`Update details for "${location.name}".`}
      backTo="/settings/locations"
      backLabel="Back to Locations"
    >
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
      <LocationEditForm
        idPrefix="settings-location-edit"
        location={location}
        onUpdated={(updated) => {
          setSuccess(`Location "${updated.name}" updated.`);
          setLocation(updated);
          navigate(`/settings/locations/${updated.slug ?? updated.id}/edit`, { replace: true });
        }}
        onCancel={() => navigate("/settings/locations")}
      />
    </SettingsLayout>
  );
}