import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderTree, Layers, Tags } from "lucide-react";
import { api, type Discipline, type PaginationMeta, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import Pagination from "../../components/settings/Pagination";

const PER_PAGE = 20;

export default function Disciplines() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsFailed, setSkillsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Discipline | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  useEffect(() => {
    Promise.all([
      api.adminDisciplines({ page, per_page: PER_PAGE }),
      api.adminSkills({ per_page: 1000 }).catch(() => {
        setSkillsFailed(true);
        return { data: [] as Skill[], meta: { page: 1, per_page: 1000, total: 0, total_pages: 1 } };
      }),
    ])
      .then(([catsRes, skRes]) => {
        setDisciplines(catsRes.data);
        setMeta(catsRes.meta);
        setSkills(skRes.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  const skillCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (!skills) return counts;
    skills.forEach((s) => {
      counts.set(s.discipline_id, (counts.get(s.discipline_id) ?? 0) + 1);
    });
    return counts;
  }, [skills]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyDiscipline(pendingDelete.id, confirmForce);
      setDisciplines((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
      setConfirmForce(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete discipline.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title="Disciplines"
      description="Manage disciplines. Click a name to view details."
      backTo="/settings"
      backLabel="Back to Settings"
      hero={{
        eyebrow: "Data management",
        highlights: [
          { icon: Tags, label: "Group skills" },
          { icon: Layers, label: "Nest disciplines" },
          { icon: FolderTree, label: "Reorder freely" },
        ],
        highlightsLabel: "Discipline management features",
        theme: "library-hero--settings",
      }}
      actions={
        <Link to="/settings/disciplines/new" className="admin-btn admin-btn-add settings-add-btn">
          + Add New Discipline
        </Link>
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <p className="settings-result-count">
        {meta ? `${meta.total} ${meta.total === 1 ? "discipline" : "disciplines"}` : `${disciplines.length} ${disciplines.length === 1 ? "discipline" : "disciplines"}`}
      </p>
      {pendingDelete && (
        <>
          <DeleteConfirm
            entityName={pendingDelete.name}
            warning="This action cannot be undone. If this discipline has skills, deletion will be blocked unless you confirm force-delete below."
            onCancel={() => {
              setPendingDelete(null);
              setDeleteError(null);
              setConfirmForce(false);
            }}
            onConfirm={handleDelete}
            deleting={deleting}
            error={deleteError}
          />
          <label className="delete-confirm-force">
            <input
              type="checkbox"
              checked={confirmForce}
              onChange={(e) => setConfirmForce(e.target.checked)}
            />
            Also delete skills in this discipline (force delete)
          </label>
        </>
      )}
      <AdminTable<Discipline>
        data={disciplines}
        loading={loading}
        emptyTitle="No disciplines"
        emptyDescription="Get started by adding a new discipline."
        onEdit={(c) => navigate(`/settings/disciplines/${c.slug}/edit`)}
        onDelete={(c) => {
          setPendingDelete(c);
          setDeleteError(null);
          setConfirmForce(false);
        }}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (c) => (
              <Link to={`/settings/disciplines/${c.slug}`} className="admin-table-name">
                {c.name}
              </Link>
            ),
          },
          { key: "slug", label: "Slug", render: (c) => c.slug },
          {
            key: "skills",
            label: "Skills",
            render: (c) => {
              if (skillsFailed) return "—";
              const count = skillCounts.get(c.id) ?? 0;
              return (
                <Link
                  to={`/settings/skills?discipline=${c.id}`}
                  state={{ from: "Disciplines", fromPath: "/settings/disciplines", disciplineName: c.name }}
                  className="admin-table-name"
                >
                  {count}
                </Link>
              );
            },
          },
        ]}
      />
      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={PER_PAGE}
          onPageChange={setPage}
        />
      )}
    </SettingsLayout>
  );
}
