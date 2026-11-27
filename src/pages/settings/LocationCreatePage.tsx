import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Info, MapPin, ShieldCheck } from "lucide-react";
import BackLink from "../../components/settings/BackLink";
import LibraryHero from "../../components/LibraryHero";
import LocationForm from "../../components/locations/LocationForm";

export default function LocationCreatePage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="page location-editor-page">
      <BackLink to="/locations" label="Back to locations" />
      <LibraryHero
        eyebrow="Venue catalogue"
        title="Propose a new venue"
        description="Add a beach, club or sports venue so organisers can schedule tournaments and training sessions there."
        highlights={[
          { icon: MapPin, label: "Address & coordinates" },
          { icon: Building2, label: "Link an organisation" },
          { icon: ShieldCheck, label: "Reviewed by the BVBH team" },
        ]}
        highlightsLabel="Location proposal features"
        theme="library-hero--locations"
      />
      {success && (
        <div className="auth-flash auth-flash-success" role="status">
          {success}
        </div>
      )}
      <div className="location-editor-layout">
        <div className="location-editor-main">
          <div className="location-editor-panel">
            <LocationForm
              mode="create"
              idPrefix="location-create"
              heading="Venue details"
              defaultExpanded
              navigate={navigate}
              onCreated={(location) => {
                setSuccess(`Location "${location.name}" created.`);
                setTimeout(() => navigate("/locations"), 1500);
              }}
            />
          </div>
        </div>
        <aside className="location-editor-sidebar" aria-label="Proposal guidance">
          <section className="location-editor-card">
            <h2>
              <Info size={16} aria-hidden="true" /> What happens next
            </h2>
            <ol className="location-editor-steps">
              <li>
                Your venue appears in the catalogue straight away, marked as
                awaiting verification.
              </li>
              <li>
                The BVBH team reviews the details and confirms the address and
                map pin.
              </li>
              <li>
                Once verified, every organiser can attach it to tournaments and
                training sessions.
              </li>
            </ol>
          </section>
          <section className="location-editor-card">
            <h2>
              <MapPin size={16} aria-hidden="true" /> Pinpoint accuracy
            </h2>
            <p className="location-editor-card-copy">
              A full street address or precise latitude/longitude lets the map
              resolve the venue automatically — add whichever you have.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}