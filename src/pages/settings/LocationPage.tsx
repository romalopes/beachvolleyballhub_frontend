import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import BackLink from "../../components/settings/BackLink";
import LocationForm from "../../components/locations/LocationForm";
import LocationMap from "../../components/locations/LocationMap";
import LibraryHero from "../../components/LibraryHero";
import { api, type Location } from "../../api";
import { ArrowLeft, MapPin, ShieldCheck, AlertCircle, Archive, Plus, UserCircle } from "lucide-react";

export type LocationPageMode = "create" | "edit";

interface LocationPageProps {
  mode: LocationPageMode;
}

export default function LocationPage({ mode }: LocationPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const canOverseeLocations = user?.roles?.some(
    (role) => role === "admin" || role === "curator",
  );

  // Load location data for edit mode
  useEffect(() => {
    if (mode !== "edit" || !slug) {
      setLoading(false);
      return;
    }
    api
      .location(slug)
      .then((loc) => {
        setLocation(loc);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, mode]);

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

  const handleFormSubmit = async (updated: Location) => {
    setSuccess(`Location "${updated.name}" ${mode === "create" ? "created" : "updated"}.`);
    setLocation(updated);
    if (mode === "edit") {
      navigate(`/locations/${updated.slug ?? updated.id}/edit`, { replace: true });
    } else {
      setTimeout(() => navigate("/locations"), 1500);
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

  if (mode === "edit" && !location) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">Location not found.</div>
        <BackLink to="/locations" label="Back to locations" />
      </div>
    );
  }

  const isOwnerProposal = location?.proposed_by_account_id === user?.account_id;
  const canOverseeLocations = user?.roles?.some(
    (role) => role === "admin" || role === "curator",
  );
  const canEditLocationFinal =
    canOverseeLocations || (isOwnerProposal && location?.verification_status !== "verified");
