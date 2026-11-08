import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Discipline, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import EmptyState from "../../components/EmptyState";
import ResourceTable from "../../components/settings/ResourceTable";

export default function DisciplineDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      api.adminDiscipline(slug),
      api.adminSkills({ per_page: 1000 }).catch(() => {
        return { data: [] as Skill[], meta: { page: 1, per_page: 1000, total: 0, total_pages: 1 } };
      }),
    ])
      .then(([cat, skRes]) => {
        setDiscipline(cat);
        setSkills(skRes.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const disciplineSkills = useMemo(
    () => skills.filter((s) => s.discipline_id === discipline?.id),
    [skills, discipline]
  );

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
      <SettingsLayout title="Discipline" backTo="/settings/disciplines" backLabel="Back to Disciplines">
        <div className="auth-flash auth-flash-error">{error}</div>
      </SettingsLayout>
    );
  }
  if (!discipline) {
    return (
      <SettingsLayout title="Discipline" backTo="/settings/disciplines" backLabel="Back to Disciplines">
        <EmptyState title="Discipline not found" />
      </SettingsLayout>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyDiscipline(discipline.id);
      navigate("/settings/disciplines");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete discipline.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title={discipline.name}
      description="Discipline details."
      backTo="/settings/disciplines"
      backLabel="Back to Disciplines"
      actions={
        <div className="admin-table-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={() => navigate(`/settings/disciplines/${discipline.slug}/edit`)}>
            Edit
          </button>
          <button type="button" className="admin-btn admin-btn-remove" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
      }
    >
      {confirming && (
        <DeleteConfirm
          entityName={discipline.name}
          onCancel={() => {
            setConfirming(false);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}
      <div className="detail-section">
        <h2>Details</h2>
        <p>Slug: {discipline.slug}</p>
      </div>
      <div className="detail-section">
        <h2>Skills in this discipline</h2>
        <ResourceTable<Skill>
          data={disciplineSkills}
          emptyTitle="No skills in this discipline"
          emptyDescription="Skills assigned to this discipline will appear here."
          columns={[
            {
              key: "title",
              label: "Name",
              render: (s) => (
                <Link to={`/skills/${s.slug}`} className="admin-table-name">
                  {s.title}
                </Link>
              ),
            },
            { key: "discipline", label: "Discipline", render: (s) => s.discipline?.name ?? "—" },
            {
              key: "description",
              label: "Description",
              render: (s) =>
                s.description
                  ? s.description.length > 80
                    ? `${s.description.slice(0, 80)}…`
                    : s.description
                  : "—",
            },
          ]}
        />
      </div>
    </SettingsLayout>
  );
}
