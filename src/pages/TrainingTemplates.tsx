import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarPlus, Plus } from "lucide-react";
import {
  api,
  type Organisation,
  type TrainingTemplate,
} from "../api";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import TrainingTemplateCard from "../components/training/TrainingTemplateCard";

/**
 * Training template directory, laid out like the tournaments directory: header
 * actions, a filter aside and a card grid.
 *
 * URL contract: `q`, `organisation_id`, `archived=1`.
 */
export default function TrainingTemplates() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const organisationId = searchParams.get("organisation_id") ?? "";
  const includeArchived = searchParams.get("archived") === "1";

  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .organisations("active")
      .then((response) => setOrganisations(response.data))
      .catch((err: Error) =>
        console.warn("Could not load template organisations:", err),
      );
  }, []);

  useEffect(() => {
    api
      .trainingTemplates({
        include_archived: includeArchived,
        organisation_id: organisationId ? Number(organisationId) : undefined,
        q: query || undefined,
        per_page: 100,
      })
      .then((response) => {
        setTemplates(response.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [includeArchived, organisationId, query, refreshKey]);

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next);
  };

  const runAction = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      setRefreshKey((key) => key + 1);
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

      <div className="training-page-content">
        <aside className="training-filters" aria-label="Template filters">
          <h2>Filters</h2>
          <form className="filter-form" onSubmit={(event) => event.preventDefault()}>
            <div className="form-group">
              <label htmlFor="template-search">Search</label>
              <input
                id="template-search"
                type="search"
                value={query}
                placeholder="Search templates..."
                onChange={(event) =>
                  updateParams({ q: event.target.value || undefined })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="template-organisation-filter">Organisation</label>
              <select
                id="template-organisation-filter"
                value={organisationId}
                onChange={(event) =>
                  updateParams({ organisation_id: event.target.value || undefined })
                }
              >
                <option value="">Any organisation</option>
                {organisations.map((organisation) => (
                  <option key={organisation.id} value={organisation.id}>
                    {organisation.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="form-group">
              <legend>Visibility</legend>
              <label>
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) =>
                    updateParams({ archived: event.target.checked ? "1" : undefined })
                  }
                />
                Show archived templates
              </label>
            </fieldset>
            <div className="form-actions">
              <button
                type="button"
                className="admin-btn"
                onClick={() =>
                  updateParams({ q: undefined, organisation_id: undefined, archived: undefined })
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
          ) : templates.length === 0 ? (
            <EmptyState
              title="No training templates"
              description="Create a template to reuse the same training definition."
            />
          ) : (
            <div className="training-cards-grid">
              {templates.map((template) => (
                <TrainingTemplateCard
                  key={template.id}
                  template={template}
                  busy={busyId === template.id}
                  onEdit={() => navigate(`/training/templates/${template.id}/edit`)}
                  onSchedule={() =>
                    navigate(`/training/series/new?template_id=${template.id}`)
                  }
                  onClone={() =>
                    runAction(template.id, () => api.cloneTrainingTemplate(template.id))
                  }
                  onToggleArchive={() =>
                    runAction(template.id, () =>
                      template.status === "archived"
                        ? api.restoreTrainingTemplate(template.id)
                        : api.archiveTrainingTemplate(template.id),
                    )
                  }
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
