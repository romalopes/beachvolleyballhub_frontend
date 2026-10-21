import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import {
  api,
  type TrainingSeries,
  type TrainingSession,
  type TrainingSessionStatus,
} from "../api";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import SeriesOccurrenceTable from "../components/training/SeriesOccurrenceTable";
import SeriesActionsPanel from "../components/training/SeriesActionsPanel";
import Tag from "../components/Tag";
import {
  seriesScheduleLabel,
  seriesStatusLabel,
  weekdaysLabel,
} from "../utils/recurringTraining";
import { TRAINING_STATUSES } from "../utils/training";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TrainingSeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const seriesId = Number(id);
  const navigate = useNavigate();

  const [series, setSeries] = useState<TrainingSeries | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sessionStatus, setSessionStatus] =
    useState<"all" | TrainingSessionStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    return Promise.all([
      api.trainingSeries(seriesId),
      api.trainingSeriesSessions(seriesId, {
        per_page: 100,
        status: sessionStatus === "all" ? undefined : sessionStatus,
      }),
    ])
      .then(([seriesRow, sessionPage]) => {
        setSeries(seriesRow);
        setSessions(sessionPage.data);
        setSelected(new Set());
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
    // The reload closure intentionally captures the current series id/filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, sessionStatus]);

  const summary = useMemo(() => {
    if (!series) return null;
    return {
      scheduled: series.scheduled_count ?? 0,
      cancelled: series.cancelled_count ?? 0,
      completed: series.completed_count ?? 0,
    };
  }, [series]);

  if (Number.isNaN(seriesId)) {
    return (
      <div className="page">
        <p className="admin-error">That series id is not valid.</p>
      </div>
    );
  }

  if (loading) return <LoadingState />;
  if (error || !series) {
    return (
      <div className="page">
        <p className="admin-error">{error ?? "Series not found"}</p>
        <button type="button" className="admin-btn" onClick={() => navigate("/training/series")}>
          Back to series
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={series.training_template?.name ?? `Training series #${series.id}`}
        description={seriesScheduleLabel(series)}
      >
        <button
          type="button"
          className="admin-btn"
          onClick={() => navigate("/training/series")}
        >
          <ArrowLeft size={16} /> All series
        </button>
        {series.training_template && (
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              navigate(`/training/templates/${series.training_template?.id}/edit`)
            }
          >
            <Pencil size={16} /> Edit template
          </button>
        )}
        <button
          type="button"
          className="admin-btn"
          onClick={() => navigate("/training/series/new")}
        >
          New series
        </button>
      </PageHeader>

      <section className="detail-section series-summary">
        <div className="series-summary-item">
          <span className="related-item-meta">Status</span>
          <Tag>{seriesStatusLabel(series.status)}</Tag>
        </div>
        <div className="series-summary-item">
          <span className="related-item-meta">Dates</span>
          <strong>
            {formatDate(series.starts_on)} → {formatDate(series.ends_on)}
          </strong>
        </div>
        <div className="series-summary-item">
          <span className="related-item-meta">Weekdays</span>
          <strong>{weekdaysLabel(series.weekdays)}</strong>
        </div>
        <div className="series-summary-item">
          <span className="related-item-meta">Schedule</span>
          <strong>
            {series.local_start_time.slice(0, 5)} · {series.time_zone}
          </strong>
        </div>
        {summary && (
          <div className="series-summary-item">
            <span className="related-item-meta">Occurrences</span>
            <strong>
              {summary.scheduled} scheduled · {summary.cancelled} cancelled ·{" "}
              {summary.completed} completed
            </strong>
          </div>
        )}
        {series.next_occurrence_at && (
          <div className="series-summary-item">
            <span className="related-item-meta">Next</span>
            <strong>
              {new Date(series.next_occurrence_at).toLocaleString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </strong>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2>Occurrences</h2>
        <p className="related-item-meta">
          Select occurrences to act on them. Cancelling keeps the row as a tombstone;
          deleting is only allowed for unused drafts.
        </p>
        <label className="admin-field recurrence-status-filter">
          <span>Status</span>
          <select
            value={sessionStatus}
            onChange={(event) =>
              setSessionStatus(event.target.value as "all" | TrainingSessionStatus)
            }
          >
            <option value="all">All</option>
            {TRAINING_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <SeriesOccurrenceTable
          sessions={sessions}
          selected={selected}
          onSelectionChange={setSelected}
          timeZone={series.time_zone}
        />
        <p className="field-hint">
          {selected.size} selected.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Clear selection
          </button>
        </p>
      </section>

      <SeriesActionsPanel
        series={series}
        selectedIds={[...selected]}
        onChanged={() => {
          void reload();
        }}
      />

      <section className="detail-section">
        <h2>Series details</h2>
        <dl className="detail-list">
          <dt>Template</dt>
          <dd>{series.training_template?.name ?? "—"}</dd>
          <dt>Organisation</dt>
          <dd>{series.organisation?.name ?? "—"}</dd>
          <dt>Generated through</dt>
          <dd>{series.generated_through ?? "—"}</dd>
          <dt>Created by</dt>
          <dd>{series.created_by?.name ?? "—"}</dd>
          <dt>Visibility</dt>
          <dd>{String(series.defaults.visibility ?? "shared")}</dd>
        </dl>
        <button
          type="button"
          className="admin-btn"
          onClick={() => navigate(`/training?training_series_id=${series.id}`)}
        >
          <ExternalLink size={14} /> Open in training list
        </button>
      </section>
    </div>
  );
}
