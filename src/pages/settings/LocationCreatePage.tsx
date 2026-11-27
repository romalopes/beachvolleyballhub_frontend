import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, UserCircle } from "lucide-react";
import LocationForm from "../../components/locations/LocationForm";

export default function LocationCreatePage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="page">
      <header className="organisations-library-hero">
        <div className="organisations-library-hero-copy">
          <span className="analysis-eyebrow">Create venue</span>
          <h1>Propose a new location</h1>
          <p>Add a new venue/location to the catalogue.</p>
          <div className="organisations-library-highlights" aria-label="Location creation features">
            <span><MapPin size={14} /> Add venue details</span>
            <span><UserCircle size={14} /> Linked to organisation (optional)</span>
          </div>
        </div>
      </header>
      <h2>Propose a Location</h2>
      <p>Propose a new venue/location.</p>
      {success && (
        <div className="auth-flash auth-flash-success" role="alert">
          {success}
        </div>
      )}
      <LocationForm
        mode="create"
        idPrefix="location-create"
        defaultExpanded
        navigate={navigate}
        onCreated={(location) => {
          setSuccess(`Location "${location.name}" created.`);
          setTimeout(() => navigate("/locations"), 1500);
        }}
      />
    </div>
  );
}