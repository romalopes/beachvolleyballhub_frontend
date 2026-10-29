import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarRange,
  LayoutTemplate,
  List,
  Plus,
  Users,
} from "lucide-react";
import { api, type TrainingSession, type TrainingSessionStatus } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import GroupedWeekList from "../components/GroupedWeekList";
import LoadingState from "../components/LoadingState";
import LibraryHero from "../components/LibraryHero";
import CalendarToolbar, {
  CalendarToolbarTabs,
} from "../components/calendar/CalendarToolbar";
import TrainingCalendarGrid from "../components/training/TrainingCalendarGrid";
import TrainingFilterForm from "../components/training/TrainingFilterForm";
import TrainingSessionCard from "../components/training/TrainingSessionCard";
import {
  addDays,
  addMonths,
  monthIsoWeekRange,
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
  const status = (searchParams.get("status") ?? "") as
    | TrainingSessionStatus
    | "";
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
  const listRange = useMemo(() => monthIsoWeekRange(cursor), [cursor]);
  const navigationRange: CalendarRange = view === "list" ? "month" : range;

  // The list view groups sessions into calendar weeks (Monday–Sunday).
  const weekGroups = useMemo(() => sessionsByWeek(sessions), [sessions]);

  useEffect(() => {
    const filters = {
      status: status || undefined,
      mine: mine || undefined,
      training_series_id: seriesFilter ?? undefined,
    };
    const requestRange =
      view === "calendar"
        ? {
            starts_at_from: toISODate(days[0]),
            starts_at_to: toISODate(addDays(days[days.length - 1], 1)),
          }
        : {
            starts_at_from: toISODate(listRange.start),
            starts_at_to: toISODate(listRange.endExclusive),
          };
    const request = api.trainingSessions({ ...filters, ...requestRange });

    request
      .then((loaded) => {
        setSessions(loaded);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [view, days, listRange, status, mine, seriesFilter, refreshKey]);

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next);
  };

  const title =
    navigationRange === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `Week of ${cursor.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;

  const moveCursor = (offset: number) => {
    const next =
      navigationRange === "month"
        ? addMonths(cursor, offset)
        : addDays(cursor, offset * 7);
    updateParams({ cursor: toISODate(next) });
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="page">
      <LibraryHero
        eyebrow="Coaching schedule"
        title="Training"
        description="The shared training schedule. Switch between the list and the calendar; select a session to open its details."
        highlights={[
          { icon: CalendarRange, label: "List or calendar" },
          { icon: LayoutTemplate, label: "Reusable templates" },
          { icon: Users, label: "Plan series" },
        ]}
        highlightsLabel="Training features"
        theme="library-hero--training"
        action={
          canManage && (
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => navigate("/training/new")}
            >
              <Plus size={16} /> New Training
            </button>
          )
        }
      />

      <div className="library-hero-toolbar">
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
          </>
        )}
      </div>

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
          <CalendarToolbar
            title={title}
            options={[
              { value: "list", label: "List", icon: List },
              { value: "calendar", label: "Calendar", icon: CalendarRange },
            ]}
            value={view}
            onChange={(nextView) =>
              updateParams({
                view: nextView === "calendar" ? "calendar" : undefined,
              })
            }
            tabsAriaLabel="Training view"
            onPrevious={() => moveCursor(-1)}
            onToday={() => updateParams({ cursor: toISODate(new Date()) })}
            onNext={() => moveCursor(1)}
            previousLabel={`Previous ${navigationRange}`}
            nextLabel={`Next ${navigationRange}`}
            className="training-directory-toolbar"
          >
            {view === "calendar" && (
              <CalendarToolbarTabs
                options={[
                  { value: "month", label: "Month" },
                  { value: "week", label: "Week" },
                ]}
                value={range}
                onChange={(nextRange: CalendarRange) =>
                  updateParams({
                    range: nextRange === "week" ? "week" : undefined,
                  })
                }
                ariaLabel="Calendar range"
                className="calendar-toolbar-range"
              />
            )}
          </CalendarToolbar>

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
            <GroupedWeekList
              groups={weekGroups}
              variant="training"
              getItems={(group) => group.sessions}
              renderItem={(session) => (
                <TrainingSessionCard
                  key={session.id}
                  session={session}
                  onClick={() => navigate(`/training/${session.id}`)}
                />
              )}
            />
          )}
        </main>
      </div>
    </div>
  );
}
