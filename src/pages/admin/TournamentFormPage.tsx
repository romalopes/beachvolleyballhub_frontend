import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Tournament } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";

import TournamentForm from "./TournamentForm";

export default function AdminTournamentFormPage() {
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

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  // No tournament detail route exists under /admin, so the list is the only
  // sensible back destination for both branches.
  const backTo = "/admin/tournaments";
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
      backLabel="Back"
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {/* If the edit fetch failed there is nothing to seed the form with, so
          show the error instead of falling back to a blank create form. */}
      {error && !initial ? null : (
        <TournamentForm
          key={isNew ? "new" : (initial?.id ?? id)}
          initial={isNew ? null : initial}
          onCancel={() => navigate(backTo)}
          onSuccess={(saved) => navigate(`/admin/tournaments/${saved.id}/edit`)}
        />
      )}
    </SettingsLayout>
  );
}
