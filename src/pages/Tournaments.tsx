import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpDown,
  CalendarRange,
  CalendarDays,
  Globe2,
  List,
  Trophy,
} from "lucide-react";
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
import CalendarEvent from "../components/calendar/CalendarEvent";
import CalendarGrid from "../components/calendar/CalendarGrid";
import CalendarToolbar, {
  CalendarToolbarTabs,
} from "../components/calendar/CalendarToolbar";
import { useTournaments } from "../hooks/useTournaments";
import {
  addDays,
  addMonths,
  monthGridDays,
  toISODate,
  weekGridDays,
} from "../utils/calendar";
import {
  filtersFromSearchParams,
  monthFromSearchParam,
  tournamentRelationship,
  tournamentSearchParams,
  tournamentsByDay,
  type TournamentRange,
  type TournamentView,
} from "../utils/tournaments";

function cursorFromSearchParams(searchParams: URLSearchParams): Date {
  const value = searchParams.get("cursor");
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return monthFromSearchParam(searchParams.get("month"));
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const view: TournamentView =
    searchParams.get("view") === "list" ? "list" : "calendar";
  const range: TournamentRange =
    searchParams.get("range") === "week" ? "week" : "month";
  const cursor = useMemo(
    () => cursorFromSearchParams(searchParams),
    [searchParams],
  );
  const navigationRange: TournamentRange = view === "list" ? "month" : range;
  const days = useMemo(
    () =>
      navigationRange === "month"
        ? monthGridDays(cursor)
        : weekGridDays(cursor),
    [cursor, navigationRange],
  );
  const [options, setOptions] = useState<TournamentOptions | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const { user } = useAuth();

  const updateUrl = useCallback(
    (
      nextFilters: TournamentFilters,
      nextView = view,
      nextCursor = cursor,
      nextRange = range,
    ) => {
      setSearchParams(
        tournamentSearchParams(nextFilters, nextView, nextCursor, nextRange),
      );
    },
    [cursor, range, setSearchParams, view],
  );
  const rangeFilters = useMemo<TournamentFilters>(
    () => ({
      ...filters,
      starts_at: toISODate(days[0]),
      ends_at: toISODate(addDays(days[days.length - 1], 1)),
    }),
    [days, filters],
  );
  const { tournaments } = useTournaments("all", rangeFilters);
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
  const title =
    navigationRange === "month"
      ? cursor.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : `Week of ${cursor.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
  const moveCursor = (offset: number) =>
    updateUrl(
      filters,
      view,
      navigationRange === "month"
        ? addMonths(cursor, offset)
        : addDays(cursor, offset * 7),
      range,
    );

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
      <div className="tournaments-page-content">
        <aside
          className="tournaments-filters"
          aria-label="Tournament filters"
          aria-expanded={!isFiltersCollapsed}
        >
          <h2>Filters</h2>
          <button
            type="button"
            className="filter-toggle-btn"
            onClick={() => setIsFiltersCollapsed((prev) => !prev)}
            aria-pressed={isFiltersCollapsed}
          >
            {isFiltersCollapsed ? (
              <ArrowUpDown size={24} />
            ) : (
              <ArrowUpDown size={24} />
            )}
          </button>
          {isFiltersCollapsed ? null : (
            <TournamentFilterForm
              filters={filters}
              options={options ?? undefined}
              organisations={organisations}
              onChange={(changes) =>
                updateUrl({ ...filters, ...changes })
              }
            />
          )}
        </aside>
        <main className="tournaments-list">
          <CalendarToolbar
            title={title}
            options={[
              { value: "list", label: "List", icon: List },
              { value: "calendar", label: "Calendar", icon: CalendarRange },
            ]}
            value={view}
            onChange={(nextView: TournamentView) =>
              updateUrl(filters, nextView)
            }
            tabsAriaLabel="Tournament view"
            onPrevious={() => moveCursor(-1)}
            onToday={() => updateUrl(filters, view, new Date())}
            onNext={() => moveCursor(1)}
            previousLabel={`Previous ${navigationRange}`}
            nextLabel={`Next ${navigationRange}`}
            className="tournament-calendar-nav"
          >
            {view === "calendar" && (
              <CalendarToolbarTabs
                options={[
                  { value: "month", label: "Month" },
                  { value: "week", label: "Week" },
                ]}
                value={range}
                onChange={(nextRange: TournamentRange) =>
                  updateUrl(filters, view, cursor, nextRange)
                }
                ariaLabel="Calendar range"
                className="calendar-toolbar-range"
              />
            )}
            <span className="tournament-timezone">
              Calendar dates use each tournament’s timezone.
            </span>
          </CalendarToolbar>
          <FilterState
            filters={filters}
            organisations={organisations}
            onReset={() => updateUrl({}, view)}
          />
          {view === "list" ? (
            <TournamentList
              filter="all"
              baseFilters={rangeFilters}
              tournaments={tournaments}
              groupByWeek
            />
          ) : (
            <CalendarGrid
              days={days}
              itemsByDay={grouped}
              cursor={cursor}
              range={range}
              className="tournament-calendar"
              ariaLabel={`${title} tournament calendar`}
              renderItem={(tournament, key) => {
                // Cancelled events keep their red-stripe treatment;
                // the relationship stripe would only fight it.
                const relationship =
                  tournament.publication_state === "cancelled"
                    ? null
                    : tournamentRelationship(tournament, user?.account_id);
                return (
                  <CalendarEvent
                    key={`${tournament.id}-${key}`}
                    className={`tournament-calendar-event${tournament.publication_state === "cancelled" ? " cancelled" : ""}${relationship ? ` tournament-calendar-event--${relationship}` : ""}`}
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                    title={tournament.name}
                    details={
                      <>
                        {tournament.organisation.name}
                        {tournament.publication_state === "cancelled"
                          ? " · Cancelled"
                          : ""}
                      </>
                    }
                  />
                );
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
