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

  useEffect(() => {
    if (!user?.roles?.includes("admin")) return;
    if (!slug) return;
    api
      .location(slug)
      .then((loc) => {
        setLocation(loc);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, user]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error) {
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