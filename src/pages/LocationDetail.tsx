import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, type Location } from "../api";
import { useAuth } from "../auth/AuthContext";
import { ArrowLeft } from "lucide-react";

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
        <Link to="/settings/locations" className="admin-btn">
          Back to locations
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="detail-section">
        <h2>{location.name}</h2>
        <Link to="/settings/locations" className="related-item-meta">
          <ArrowLeft size={12} aria-hidden="true" />
          Back to locations
        </Link>
        <Link to={`/settings/locations/${location.slug ?? location.id}/edit`} className="admin-btn admin-btn-add">Edit</Link>
      </section>
      {location.formatted_address && <p className="related-item-meta"><strong>Address:</strong> {location.formatted_address}</p>}
      {location.locality && <p className="related-item-meta"><strong>Locality:</strong> {location.locality}</p>}
      {location.administrative_area && <p className="related-item-meta"><strong>Administrative area:</strong> {location.administrative_area}</p>}
      {location.country_code && <p className="related-item-meta"><strong>Country code:</strong> {location.country_code}</p>}
      {location.timezone && <p className="related-item-meta"><strong>Timezone:</strong> {location.timezone}</p>}
      {location.latitude !== null && location.longitude !== null && <p className="related-item-meta"><strong>Coordinates:</strong> {location.latitude}, {location.longitude}</p>}
      {location.map_url && (
        <section className="detail-section">
          <h3>Map</h3>
          <a href={location.map_url} target="_blank" rel="noopener noreferrer">
            {location.map_url}
          </a>
        </section>
      )}
      {(user?.roles?.includes("admin") || user?.roles?.includes("curator")) && (
        <section className="detail-section">
          <h3>Actions</h3>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            <button className="admin-btn" onClick={() => navigate(`/settings/locations/${location.slug ?? location.id}/edit`)}>Edit</button>
          </div>
        </section>
      )}
      <footer className="page-footer"><Link to="/settings/locations" className="related-item-meta">Back to locations</Link></footer>
    </div>
  );
}