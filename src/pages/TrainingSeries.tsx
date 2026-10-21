import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, LayoutTemplate, Plus } from "lucide-react";
import { api, type TrainingSeries, type TrainingSeriesStatus } from "../api";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import Tag from "../components/Tag";
import {
  seriesScheduleLabel,
  seriesStatusLabel,
  weekdaysLabel,
} from "../utils/recurringTraining";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TrainingSeriesPage() {
  const navigate = useNavigate();
  const [series, setSeries] = useState<TrainingSeries[]>([]);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [status, setStatus] = useState<TrainingSeriesStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .trainingSeriesList({
        upcoming: showUpcoming,
        status: status === "all" ? undefined : status,
        per_page: 100,
      })
      .then((response) => {
        setSeries(response.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [showUpcoming, status]);

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

      <div className="recurrence-filter-row">
        <label className="recurrence-toggle">
          <input
            type="checkbox"
            checked={showUpcoming}
            onChange={(event) => setShowUpcoming(event.target.checked)}
          />
          Upcoming only
        </label>
        <label className="admin-field recurrence-status-filter">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as TrainingSeriesStatus | "all")
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="stopped">Stopped</option>
          </select>
        </label>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {loading ? (
        <LoadingState />
      ) : series.length === 0 ? (
        <EmptyState
          title="No recurring series"
          description="Schedule a series from a template to generate weekly sessions."
        />
      ) : (
        <div className="training-list">
          {series.map((row) => (
            <div
              key={row.id}
              className={`training-item${row.status === "stopped" ? " training-cancelled" : ""}`}
              onClick={() => navigate(`/training/series/${row.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  navigate(`/training/series/${row.id}`);
                }
              }}
            >
              <div className="training-item-info">
                <h4>{row.training_template?.name ?? `Series #${row.id}`}</h4>
                <p>
                  {seriesScheduleLabel(row)}
                  {row.organisation ? ` · ${row.organisation.name}` : ""}
                </p>
                <p className="related-item-meta">
                  {formatDate(row.starts_on)} → {formatDate(row.ends_on)} ·{" "}
                  {weekdaysLabel(row.weekdays)}
                </p>
              </div>
              <span className="training-item-meta">
                <Tag>{seriesStatusLabel(row.status)}</Tag>
                {row.completed && <Tag>Finished</Tag>}
                {row.occurrence_count != null && (
                  <span className="related-item-meta">
                    {row.occurrence_count} occurrence
                    {row.occurrence_count === 1 ? "" : "s"}
                  </span>
                )}
                <span className="related-item-meta">
                  <CalendarPlus size={14} style={{ marginRight: "0.25rem" }} />
                  {row.next_occurrence_at
                    ? `Next ${new Date(row.next_occurrence_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : "No upcoming occurrence"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
