import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import LocationCreateForm from "../../components/locations/LocationCreateForm";

export default function LocationCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [success, setSuccess] = useState<string | null>(null);

  const canOverseeLocations = user?.roles?.some(
    (role) => role === "admin" || role === "curator",
  );

  if (!canOverseeLocations) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Create Location"
      description="Propose a new venue/location."
      backTo="/settings/locations"
      backLabel="Back to Locations"
    >
      {success && (
        <div className="auth-flash auth-flash-success" role="alert">
          {success}
        </div>
      )}
      <LocationCreateForm
        idPrefix="settings-location"
        defaultExpanded
        onCreated={(location) => {
          setSuccess(`Location "${location.name}" created.`);
          setTimeout(() => navigate("/settings/locations"), 1500);
        }}
      />
    </SettingsLayout>
  );
}