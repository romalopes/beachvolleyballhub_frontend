import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Globe,
  Info,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import BackLink from "../../components/settings/BackLink";
import LibraryHero from "../../components/LibraryHero";
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

  if (loading) {
    return (
      <div className="page location-editor-page">
        <div className="loading" role="status">Loading venue...</div>
      </div>
    );
  }
  if (error && !location) {
    return (
      <div className="page location-editor-page">
        <BackLink to="/locations" label="Back to locations" />
        <div className="auth-flash auth-flash-error" role="alert">
          {error}
        </div>
      </div>
    );
  }
  if (!location) {
    return (
      <div className="page location-editor-page">
        <BackLink to="/locations" label="Back to locations" />
        <div className="auth-flash auth-flash-error" role="alert">
          Location not found.
        </div>
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

  const addressSummary =
    location.formatted_address ||
    [location.locality, location.administrative_area, location.country_code]
      .filter(Boolean)
      .join(", ");
  const hasCoordinates =
    location.latitude !== null && location.longitude !== null;
  const hasMap = Boolean(location.map_url) || hasCoordinates;
  const rawTypeLabel = location.location_type.replace(/_/g, " ");
  const typeLabel = rawTypeLabel.charAt(0).toUpperCase() + rawTypeLabel.slice(1);
  const verificationLabel =
    location.verification_status.charAt(0).toUpperCase() +
    location.verification_status.slice(1);

  return (
    <div className="page location-editor-page">
      <BackLink to="/locations" label="Back to locations" />
      <LibraryHero
        eyebrow="Venue workspace"
        title={`Edit ${location.name}`}
        description={
          addressSummary ||
          "No address on file yet — add one below so the venue pin resolves correctly."
        }
        highlights={[
          { icon: Building2, label: typeLabel },
          {
            icon: MapPin,
            label:
              location.locality ||
              location.administrative_area ||
              "Locality pending",
          },
          { icon: ShieldCheck, label: verificationLabel },
        ]}
        highlightsLabel="Venue summary"
        theme="library-hero--locations"
        action={
          <Link
            to={`/locations/${location.slug ?? location.id}`}
            className="location-editor-hero-action"
          >
            <ArrowUpRight size={16} aria-hidden="true" />
            View venue
          </Link>
        }
      />

      {success && (
        <div className="auth-flash auth-flash-success" role="status">
          {success}
        </div>
      )}
      {error && (
        <div className="auth-flash auth-flash-error" role="alert">
          {error}
        </div>
      )}

      <div className="location-editor-layout">
        <div className="location-editor-main">
          {canEditLocation ? (
            <div className="location-editor-panel">
              <LocationForm
                mode="edit"
                idPrefix="location-edit"
                heading="Venue details"
                location={location}
                onUpdated={(updated) => {
                  setSuccess(`Location "${updated.name}" updated.`);
                  setLocation(updated);
                  navigate(`/locations/${updated.slug ?? updated.id}/edit`, {
                    replace: true,
                  });
                }}
                onCancel={() => navigate("/locations")}
              />
            </div>
          ) : (
            <div className="location-editor-notice" role="status">
              <Info size={18} aria-hidden="true" />
              <div>
                <strong>This venue is read-only for you.</strong>
                <p>
                  Only the account that proposed a venue can edit it before
                  verification, and only admins or curators can manage verified
                  venues.
                </p>
              </div>
            </div>
          )}

          {hasMap && (
            <section
              className="location-editor-card"
              aria-labelledby="location-edit-map-heading"
            >
              <h2 id="location-edit-map-heading">
                <MapPin size={16} aria-hidden="true" /> Map
              </h2>
              <LocationMap
                name={location.name}
                latitude={location.latitude}
                longitude={location.longitude}
                externalUrl={location.map_url}
              />
            </section>
          )}
        </div>


        <aside className="location-editor-sidebar" aria-label="Venue status">
          {canOverseeLocations && (
            <section
              className="location-editor-card"
              aria-labelledby="location-lifecycle-heading"
            >
              <h2 id="location-lifecycle-heading">
                <Activity size={16} aria-hidden="true" /> Location status
              </h2>
              <dl className="location-editor-status-list">
                <div>
                  <dt>Verification</dt>
                  <dd>
                    <span
                      className={`status-badge status-${location.verification_status}`}
                    >
                      {location.verification_status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Lifecycle</dt>
                  <dd>
                    <span className={`status-badge status-${location.status}`}>
                      {location.status}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="location-editor-card-actions">
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


          {!canOverseeLocations && (
            <section className="location-editor-card">
              <h2>
                <ShieldCheck size={16} aria-hidden="true" /> Review status
              </h2>
              <p className="location-editor-card-copy">
                This venue is{" "}
                <span
                  className={`status-badge status-${location.verification_status}`}
                >
                  {location.verification_status}
                </span>
                {location.verification_status === "proposed"
                  ? ". You can keep editing it until the BVBH team verifies it."
                  : "."}
              </p>
            </section>
          )}

          <section className="location-editor-card">
            <h2>
              <Globe size={16} aria-hidden="true" /> Venue snapshot
            </h2>
            <dl className="location-editor-status-list">
              <div>
                <dt>Type</dt>
                <dd>{typeLabel}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{location.timezone || "—"}</dd>
              </div>
              <div>
                <dt>Coordinates</dt>
                <dd className="location-editor-coordinates">
                  {hasCoordinates
                    ? `${location.latitude}, ${location.longitude}`
                    : "Not set"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

