import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  List,
  Plus,
} from "lucide-react";
import {
  api,
  type TrainingSession,
  type TrainingSessionStatus,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import TrainingCalendarGrid from "../components/training/TrainingCalendarGrid";
import TrainingFilterForm from "../components/training/TrainingFilterForm";
import TrainingSessionCard from "../components/training/TrainingSessionCard";
import {
  addDays,
  addMonths,
  monthGridDays,
  toISODate,
  weekGridDays,
} from "../utils/calendar";
import { canManageTrainings, sessionsByWeek } from "../utils/training";

type TrainingView = "list" | "calendar";
type CalendarRange = "month" | "week";

function parseCursor(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * The single training directory: list and calendar share one page, one URL
 * contract and one filter set, mirroring the tournaments directory.
 *
 * URL contract: `view=list|calendar`, `range=month|week`, `cursor=YYYY-MM-DD`,
 * `status`, `mine=1`, `training_series_id`.
 */
export default function Training() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canManage = canManageTrainings(user);

  const view: TrainingView =
    searchParams.get("view") === "calendar" ? "calendar" : "list";
  const range: CalendarRange =
    searchParams.get("range") === "week" ? "week" : "month";
  const cursor = useMemo(
    () => parseCursor(searchParams.get("cursor")),
    [searchParams],
  );
  const status = (searchParams.get("status") ?? "") as TrainingSessionStatus | "";
  const mine = searchParams.get("mine") === "1";
  const seriesFilter = Number(searchParams.get("training_series_id")) || null;

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const days = useMemo(
    () => (range === "month" ? monthGridDays(cursor) : weekGridDays(cursor)),
    [range, cursor],
  );

  // The list view groups sessions into calendar weeks (Monday–Sunday).
  const weekGroups = useMemo(() => sessionsByWeek(sessions), [sessions]);

  useEffect(() => {
    const filters = {
      status: status || undefined,
      mine: mine || undefined,
      training_series_id: seriesFilter ?? undefined,
    };
    const request =
      view === "calendar"
        ? api.trainingSessions({
            ...filters,
            starts_at_from: toISODate(days[0]),
            starts_at_to: toISODate(addDays(days[days.length - 1], 1)),
          })
        : api.trainingSessions(filters);

    request
      .then((loaded) => {
        setSessions(loaded);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [view, days, status, mine, seriesFilter, refreshKey]);

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next);
  };

  const title =
    range === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `Week of ${cursor.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;

  const moveCursor = (offset: number) => {
    const next =
      range === "month" ? addMonths(cursor, offset) : addDays(cursor, offset * 7);
    updateParams({ cursor: toISODate(next) });
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Training"
        description="The shared training schedule. Switch between the list and the calendar; select a session to open its details."
      >
        <div className="training-view-toggle" role="tablist" aria-label="Training view">
          {(
            [
              { value: "list", label: "List", icon: List },
              { value: "calendar", label: "Calendar", icon: CalendarRange },
            ] as { value: TrainingView; label: string; icon: typeof List }[]
          ).map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={view === option.value}
                className={`filter-btn${view === option.value ? " active" : ""}`}
                onClick={() =>
                  updateParams({
                    view: option.value === "calendar" ? "calendar" : undefined,
                  })
                }
              >
                <Icon size={14} aria-hidden="true" /> {option.label}
              </button>
            );
          })}
        </div>
        {canManage && (
          <>
            <button
              type="button"
              className="admin-btn"
              onClick={() => navigate("/training/templates")}
            >
              <LayoutTemplate size={16} /> Templates
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => navigate("/training/series")}
            >
              <CalendarRange size={16} /> Series
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => navigate("/training/new")}
            >
              <Plus size={16} /> New Training
            </button>
          </>
        )}
      </PageHeader>

      <div className="training-page-content">
        <aside className="training-filters" aria-label="Training filters">
          <h2>Filters</h2>
          <TrainingFilterForm
            status={status}
            mine={mine}
            onChange={(patch) =>
              updateParams({
                status: patch.status ?? undefined,
                mine: patch.mine ? "1" : undefined,
              })
            }
            onReset={() => updateParams({ status: undefined, mine: undefined })}
          />
          {seriesFilter && (
            <div className="admin-info series-filter-banner">
              Showing occurrences of series #{seriesFilter}.{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => updateParams({ training_series_id: undefined })}
              >
                Clear filter
              </button>
            </div>
          )}
        </aside>

        <main className="training-list-panel">
          {view === "calendar" && (
            <div className="training-calendar-nav">
              <button
                type="button"
                className="admin-btn"
                onClick={() => moveCursor(-1)}
                aria-label="Previous period"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => updateParams({ cursor: toISODate(new Date()) })}
              >
                Today
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => moveCursor(1)}
                aria-label="Next period"
              >
                <ChevronRight size={16} />
              </button>
              <h2>{title}</h2>
              <div
                className="training-view-toggle"
                role="tablist"
                aria-label="Calendar range"
              >
                {(["month", "week"] as CalendarRange[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={range === option}
                    className={`filter-btn${range === option ? " active" : ""}`}
                    onClick={() =>
                      updateParams({ range: option === "week" ? "week" : undefined })
                    }
                  >
                    {option === "month" ? "Month" : "Week"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error ? (
            <ErrorState error={error} onRetry={retry} />
          ) : loading && sessions.length === 0 ? (
            <LoadingState />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="No training sessions"
              description={
                view === "calendar"
                  ? "Scheduled trainings for the visible dates will appear here."
                  : "Training sessions will appear here when scheduled."
              }
            />
          ) : view === "calendar" ? (
            <TrainingCalendarGrid
              days={days}
              sessions={sessions}
              range={range}
              cursor={cursor}
              onSelect={(session) => navigate(`/training/${session.id}`)}
            />
          ) : (
            <div className="training-weeks">
              {weekGroups.map((group) => (
                <section
                  key={group.key}
                  className="training-week"
                  aria-label={group.label}
                >
                  <h3 className="training-week-heading">{group.label}</h3>
                  <div className="training-cards-grid">
                    {group.sessions.map((session) => (
                      <TrainingSessionCard
                        key={session.id}
                        session={session}
                        onClick={() => navigate(`/training/${session.id}`)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
