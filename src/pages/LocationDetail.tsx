import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, type Location } from "../api";
import { useAuth } from "../auth/AuthContext";
import { ArrowLeft, MapPin, ShieldCheck, AlertCircle, Archive } from "lucide-react";
import LocationMap from "../components/locations/LocationMap";
import LibraryHero from "../components/LibraryHero";

export default function LocationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<{
    slug: string | null;
    location: Location | null;
    error: string | null;
  }>({ slug: null, location: null, error: null });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    api.location(slug)
      .then((loaded) => {
        if (!cancelled) setResult({ slug, location: loaded, error: null });
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setResult({ slug, location: null, error: requestError.message });
        }
      });
    return () => { cancelled = true; };
  }, [slug]);

  const loading = Boolean(slug) && result.slug !== slug;
  const location = result.slug === slug ? result.location : null;
  const error = result.slug === slug ? result.error : null;

  if (loading) return <div className="loading">Loading...</div>;

  if (!slug || error || !location) {
    return (
      <div className="page">
        <h2>Location not found</h2>
        <p>{error ?? `The location "${slug ?? ""}" could not be found.`}</p>
        <Link to="/locations" className="admin-btn">
          Back to locations
        </Link>
      </div>
    );
  }

  const isAdminOrCurator = user?.roles?.includes("admin") || user?.roles?.includes("curator");
  const isOwner = location.proposed_by_account_id === user?.account_id;
  const canEdit = isAdminOrCurator || (isOwner && location.verification_status !== "verified");

  // Build highlights for the hero
  const highlights = [
    {
      icon: location.verification_status === "verified" ? ShieldCheck : 
            location.verification_status === "rejected" ? AlertCircle : Archive,
      label: location.verification_status.charAt(0).toUpperCase() + location.verification_status.slice(1)
    },
    {
      icon: MapPin,
      label: location.status.charAt(0).toUpperCase() + location.status.slice(1)
    },
  ];

  // Build hero action - admin actions on the right
  const heroAction = (isAdminOrCurator || canEdit) ? (
    <div style={{ display: "flex", gap: "0.75rem" }}>
      {canEdit && (
        <Link
          to={`/locations/${location.slug ?? location.id}/edit`}
          className="btn-primary"
          style={{ padding: "0.625rem 1.25rem" }}
        >
          Edit
        </Link>
      )}
      <Link to="/locations" className="admin-btn" style={{ padding: "0.625rem 1.25rem" }}>
        Back to locations
      </Link>
    </div>
  ) : (
    <Link to="/locations" className="admin-btn" style={{ padding: "0.625rem 1.25rem" }}>
      Back to locations
    </Link>
  );

  // Address parts for description
  const addressParts = [
    location.formatted_address,
    location.locality,
    location.administrative_area,
    location.country_code,
  ].filter(Boolean).join(", ");

  const coordinateInfo = location.latitude !== null && location.longitude !== null
    ? `Coordinates: ${location.latitude}, ${location.longitude}`
    : null;

  return (
    <div className="page">
      <LibraryHero
        eyebrow="Venue"
        title={location.name}
        description={addressParts || "No address information available"}
        highlights={highlights}
        highlightsLabel="Location status"
        action={heroAction}
      />

      <section className="detail-section">
        <h3>Details</h3>
        <div className="location-details-grid">
          {location.formatted_address && (
            <div className="detail-item">
              <strong>Address:</strong> {location.formatted_address}
            </div>
          )}
          {location.locality && (
            <div className="detail-item">
              <strong>Locality:</strong> {location.locality}
            </div>
          )}
          {location.administrative_area && (
            <div className="detail-item">
              <strong>Administrative area:</strong> {location.administrative_area}
            </div>
          )}
          {location.country_code && (
            <div className="detail-item">
              <strong>Country code:</strong> {location.country_code}
            </div>
          )}
          {location.timezone && (
            <div className="detail-item">
              <strong>Timezone:</strong> {location.timezone}
            </div>
          )}
          {coordinateInfo && (
            <div className="detail-item">
              <strong>{coordinateInfo}</strong>
            </div>
          )}
          {location.map_url && (
            <div className="detail-item">
              <strong>Map URL:</strong> <a href={location.map_url} target="_blank" rel="noopener noreferrer">{location.map_url}</a>
            </div>
          )}
        </div>
      </section>

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

      <footer className="page-footer">
        <Link to="/locations" className="related-item-meta">
          <ArrowLeft size={12} aria-hidden="true" />
          Back to locations
        </Link>
      </footer>
    </div>
  );
}