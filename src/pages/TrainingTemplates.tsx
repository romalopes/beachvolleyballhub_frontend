import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  CalendarPlus,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { api, type TrainingTemplate } from "../api";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import Tag from "../components/Tag";
import { templateStatusLabel } from "../utils/recurringTraining";

export default function TrainingTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    return api
      .trainingTemplates({ include_archived: includeArchived, per_page: 100 })
      .then((response) => {
        setTemplates(response.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // The refresh closure intentionally captures the current filter only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const runAction = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Training templates"
        description="Reusable training definitions. Schedule a series from a template, or use one as the starting point for a one-off session."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={() => navigate("/training/templates/new")}
        >
          <Plus size={16} /> New template
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => navigate("/training/series/new")}
        >
          <CalendarPlus size={16} /> Schedule series
        </button>
      </PageHeader>

      <label className="recurrence-toggle">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
        />
        Show archived templates
      </label>

      {error && <div className="admin-error">{error}</div>}
      {loading ? (
        <LoadingState />
      ) : templates.length === 0 ? (
        <EmptyState
          title="No training templates"
          description="Create a template to reuse the same training definition."
        />
      ) : (
        <div className="training-list">
          {templates.map((template) => (
            <div key={template.id} className="training-item training-template-item">
              <div className="training-item-info">
                <h4>{template.name}</h4>
                <p>
                  {template.description || "No description"}
                  {template.location_summary ? ` · ${template.location_summary}` : ""}
                </p>
                <p className="related-item-meta">
                  {template.duration_minutes} min
                  {template.capacity ? ` · capacity ${template.capacity}` : ""}
                  {template.group ? ` · ${template.group.name}` : ""}
                  {template.coach_profile ? ` · ${template.coach_profile.display_name}` : ""}
                </p>
              </div>
              <span className="training-item-meta">
                <Tag>{templateStatusLabel(template.status)}</Tag>
                <Tag>{template.visibility}</Tag>
                <span className="training-template-actions">
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => navigate(`/training/templates/${template.id}/edit`)}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => navigate(`/training/series/new?template_id=${template.id}`)}
                    disabled={template.status === "archived"}
                  >
                    <CalendarPlus size={14} /> Schedule
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busyId === template.id}
                    onClick={() => runAction(template.id, () => api.cloneTrainingTemplate(template.id))}
                  >
                    <Copy size={14} /> Clone
                  </button>
                  {template.status === "archived" ? (
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyId === template.id}
                      onClick={() =>
                        runAction(template.id, () => api.restoreTrainingTemplate(template.id))
                      }
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyId === template.id}
                      onClick={() =>
                        runAction(template.id, () => api.archiveTrainingTemplate(template.id))
                      }
                    >
                      <Archive size={14} /> Archive
                    </button>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
