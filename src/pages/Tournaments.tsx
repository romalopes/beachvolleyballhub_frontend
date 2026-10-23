import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Globe2, Trophy } from "lucide-react";
import {
  api,
  type Organisation,
  type TournamentFilters,
  type TournamentOptions,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import FilterState from "../components/FilterState";
import LibraryHero from "../components/LibraryHero";
import TournamentFilterForm from "../components/TournamentFilterForm";
import TournamentList from "../components/TournamentList";
import { useTournaments } from "../hooks/useTournaments";
import {
  addDays,
  addMonths,
  monthGridDays,
  toISODate,
} from "../utils/calendar";
import {
  filtersFromSearchParams,
  monthFromSearchParam,
  tournamentRelationship,
  tournamentSearchParams,
  tournamentsByDay,
  type TournamentView,
} from "../utils/tournaments";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TournamentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const view: TournamentView =
    searchParams.get("view") === "list" ? "list" : "calendar";
  const month = useMemo(
    () => monthFromSearchParam(searchParams.get("month")),
    [searchParams],
  );
  const days = useMemo(() => monthGridDays(month), [month]);
  const [options, setOptions] = useState<TournamentOptions | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const { user } = useAuth();

  const updateUrl = useCallback(
    (nextFilters: TournamentFilters, nextView = view, nextMonth = month) => {
      setSearchParams(tournamentSearchParams(nextFilters, nextView, nextMonth));
    },
    [month, setSearchParams, view],
  );
  const rangeFilters = useMemo<TournamentFilters>(
    () => ({
      ...filters,
      starts_at: toISODate(days[0]),
      ends_at: toISODate(addDays(days[days.length - 1], 1)),
    }),
    [days, filters],
  );
  const {
    tournaments,
  } = useTournaments("all", rangeFilters);
  useEffect(() => {
    let active = true;
    api
      .tournamentOptions()
      .then((loaded) => {
        if (active) setOptions(loaded);
      })
      .catch((err) => console.warn("Could not load tournament options:", err));
    api
      .organisations("active", undefined, true)
      .then((response) => {
        if (active) setOrganisations(response.data);
      })
      .catch((err) =>
        console.warn("Could not load tournament organisations:", err),
      );
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(
    () => tournamentsByDay(tournaments ?? []),
    [tournaments],
  );
  const title = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const moveMonth = (offset: number) =>
    updateUrl(filters, view, addMonths(month, offset));

  return (
    <div className="page tournament-directory-page">
      <LibraryHero
        eyebrow="Competition directory"
        title="Tournaments"
        description="Browse beach volleyball events in the visible calendar period."
        highlights={[
          { icon: Trophy, label: "Find your events" },
          { icon: CalendarDays, label: "Calendar or list" },
          { icon: Globe2, label: "Timezone aware" },
        ]}
        highlightsLabel="Tournament directory features"
        theme="library-hero--tournaments"
        action={
          user && (
            <button
              type="button"
              className="admin-btn admin-btn-add settings-add-btn"
              onClick={() => navigate("/tournaments/new")}
            >
              Create Tournament
            </button>
          )
        }
      />
      <div className="library-hero-toolbar">
        <div
          className="training-view-toggle"
          role="tablist"
          aria-label="Tournament view"
        >
          {(["calendar", "list"] as TournamentView[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              className={`filter-btn${view === mode ? " active" : ""}`}
              onClick={() => updateUrl(filters, mode, month)}
            >
              {mode === "calendar" ? "Calendar" : "List"}
            </button>
          ))}
        </div>
        <span className="tournament-timezone">
          Calendar dates use each tournament’s timezone.
        </span>
      </div>
      <div className="tournaments-page-content">
        <aside className="tournaments-filters" aria-label="Tournament filters">
          <h2>Filters</h2>
          <TournamentFilterForm
            filters={filters}
            options={options ?? undefined}
            organisations={organisations}
            onChange={(changes) =>
              updateUrl({ ...filters, ...changes }, view, month)
            }
          />
        </aside>
        <main className="tournaments-list">
          <div className="training-calendar-nav tournament-calendar-nav">
            <button
              type="button"
              className="admin-btn"
              onClick={() => moveMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => updateUrl(filters, view, new Date())}
            >
              Today
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => moveMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
            <h2>{title}</h2>
          </div>
          <FilterState
            filters={filters}
            organisations={organisations}
            onReset={() => updateUrl({}, view, month)}
          />
          {view === "list" ? (
            <TournamentList
              filter="all"
              baseFilters={rangeFilters}
              tournaments={tournaments}
              groupByWeek
            />
          ) : (
            <div
              className="tournament-calendar"
              aria-label={`${title} tournament calendar`}
            >
              <div className="training-calendar-weekdays">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="tournament-calendar-grid">
                {days.map((day) => {
                  const key = toISODate(day);
                  const events = grouped.get(key) ?? [];
                  const outsideMonth = day.getMonth() !== month.getMonth();
                  return (
                    <section
                      key={key}
                      className={`tournament-calendar-day${outsideMonth ? " outside-month" : ""}${key === toISODate(new Date()) ? " today" : ""}`}
                      aria-label={day.toLocaleDateString()}
                    >
                      <span className="training-calendar-date">
                        {day.getDate()}
                      </span>
                      {events.map((tournament) => {
                        // Cancelled events keep their red-stripe treatment;
                        // the relationship stripe would only fight it.
                        const relationship =
                          tournament.publication_state === "cancelled"
                            ? null
                            : tournamentRelationship(tournament, user?.account_id);
                        return (
                        <button
                          key={`${tournament.id}-${key}`}
                          type="button"
                          className={`tournament-calendar-event${tournament.publication_state === "cancelled" ? " cancelled" : ""}${relationship ? ` tournament-calendar-event--${relationship}` : ""}`}
                          onClick={() =>
                            navigate(`/tournaments/${tournament.id}`)
                          }
                        >
                          <span>{tournament.name}</span>
                          <small>
                            {tournament.organisation.name}
                            {tournament.publication_state === "cancelled"
                              ? " · Cancelled"
                              : ""}
                          </small>
                        </button>
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
