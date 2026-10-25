import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import LocationCreateForm from "../../components/locations/LocationCreateForm";

export default function LocationCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [success, setSuccess] = useState<string | null>(null);

  if (!user?.roles?.includes("admin")) {
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
      backTo="/settings"
      backLabel="Back to Settings"
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
          // Optionally navigate back after a short delay
          setTimeout(() => navigate("/settings"), 1500);
        }}
      />
    </SettingsLayout>
  );
}