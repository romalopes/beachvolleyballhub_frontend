import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Discipline } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DisciplineForm from "../../components/settings/resources/disciplines/DisciplineForm";

export default function DisciplineFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !slug;
  const [initial, setInitial] = useState<Discipline | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !slug) return;
    api
      .adminDiscipline(slug)
      .then(setInitial)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, isNew]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const backTo = isNew ? "/settings/disciplines" : `/settings/disciplines/${slug}`;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <SettingsLayout
      title={isNew ? "New Discipline" : "Edit Discipline"}
      description={isNew ? "Create a new discipline." : "Update this discipline."}
      backTo={backTo}
      backLabel="Back"
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <DisciplineForm
        // Re-seed the fields when the edited record changes (the form keeps no
        // prop-syncing effect).
        key={isNew ? "new" : (initial?.id ?? slug)}
        initial={isNew ? null : initial}
        onCancel={() => navigate(backTo)}
        onSuccess={(saved) => navigate(`/settings/disciplines/${saved.slug}`)}
      />
    </SettingsLayout>
  );
}
