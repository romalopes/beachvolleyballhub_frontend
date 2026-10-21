import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutTemplate, Plus } from "lucide-react";
import {
  api,
  type TrainingSeries,
  type TrainingSeriesStatus,
  type TrainingTemplate,
} from "../api";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import TrainingSeriesCard from "../components/training/TrainingSeriesCard";

/**
 * Recurring series directory, laid out like the tournaments directory: header
 * actions, a filter aside and a card grid.
 *
 * URL contract: `status=active|stopped`, `upcoming=1`, `training_template_id`.
 */
export default function TrainingSeriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as TrainingSeriesStatus | "";
  const upcoming = searchParams.get("upcoming") === "1";
  const templateId = searchParams.get("training_template_id") ?? "";

  const [series, setSeries] = useState<TrainingSeries[]>([]);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .trainingTemplates({ per_page: 100 })
      .then((response) => setTemplates(response.data))
      .catch((err: Error) => console.warn("Could not load series templates:", err));
  }, []);

  useEffect(() => {
    api
      .trainingSeriesList({
        status: status || undefined,
        upcoming: upcoming || undefined,
        training_template_id: templateId ? Number(templateId) : undefined,
        per_page: 100,
      })
      .then((response) => {
        setSeries(response.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, upcoming, templateId, refreshKey]);

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next);
  };

  return (
    <div className="page">
      <PageHeader
        title="Recurring series"
        description="Weekly training schedules generated from a reusable template."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={() => navigate("/training/series/new")}
        >
          <Plus size={16} /> New series
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => navigate("/training/templates")}
        >
          <LayoutTemplate size={16} /> Templates
        </button>
      </PageHeader>

      <div className="training-page-content">
        <aside className="training-filters" aria-label="Series filters">
          <h2>Filters</h2>
          <form className="filter-form" onSubmit={(event) => event.preventDefault()}>
            <div className="form-group">
              <label htmlFor="series-status-filter">Status</label>
              <select
                id="series-status-filter"
                value={status}
                onChange={(event) =>
                  updateParams({ status: event.target.value || undefined })
                }
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="series-template-filter">Template</label>
              <select
                id="series-template-filter"
                value={templateId}
                onChange={(event) =>
                  updateParams({
                    training_template_id: event.target.value || undefined,
                  })
                }
              >
                <option value="">Any template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="form-group">
              <legend>Dates</legend>
              <label>
                <input
                  type="checkbox"
                  checked={upcoming}
                  onChange={(event) =>
                    updateParams({ upcoming: event.target.checked ? "1" : undefined })
                  }
                />
                Upcoming only
              </label>
            </fieldset>
            <div className="form-actions">
              <button
                type="button"
                className="admin-btn"
                onClick={() =>
                  updateParams({
                    status: undefined,
                    training_template_id: undefined,
                    upcoming: undefined,
                  })
                }
              >
                Reset
              </button>
            </div>
          </form>
        </aside>

        <main className="training-list-panel">
          {error ? (
            <ErrorState
              error={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                setRefreshKey((key) => key + 1);
              }}
            />
          ) : loading ? (
            <LoadingState />
          ) : series.length === 0 ? (
            <EmptyState
              title="No recurring series"
              description="Schedule a series from a template to generate weekly sessions."
            />
          ) : (
            <div className="training-cards-grid">
              {series.map((row) => (
                <TrainingSeriesCard
                  key={row.id}
                  series={row}
                  onClick={() => navigate(`/training/series/${row.id}`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
