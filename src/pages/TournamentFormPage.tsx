import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Tournament } from "../api";
import { useAuth } from "../auth/AuthContext";
import SettingsLayout from "../components/settings/SettingsLayout";

import TournamentForm from "./TournamentForm";

export default function TournamentFormPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !id;
  const [initial, setInitial] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    api
      .tournament(Number(id))
      .then(setInitial)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Creating and editing are open to every signed-in user: the server
  // authorises each request against the organisation's owner/administrators
  // (plus real-admin oversight), and the form only offers organisations the
  // user may create for. A signed-out visitor never gets here — the route is
  // wrapped in AuthenticatedRoute — but the guard keeps the page honest.
  if (!user) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  // The public tournaments directory is the single tournament surface now.
  const backTo = "/tournaments";
  const title = isNew ? "New Tournament" : "Edit Tournament";
  const description = isNew
    ? "Create a new tournament."
    : "Update this tournament.";

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <SettingsLayout
      title={title}
      description={description}
      backTo={backTo}
    actions={
      <a className="admin-btn" href="/tournaments">
        Back to tournaments
      </a>
    }
  >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {/* If the edit fetch failed there is nothing to seed the form with, so
          show the error instead of falling back to a blank create form. */}
      {error && !initial ? null : (
        <TournamentForm
          key={isNew ? "new" : (initial?.id ?? id)}
          initial={isNew ? null : initial}
          onCancel={() => navigate(backTo)}
          onSuccess={(saved) =>
            navigate(`/tournaments/${saved.id}/edit`)
          }
        />
      )}
    </SettingsLayout>
  );
}
