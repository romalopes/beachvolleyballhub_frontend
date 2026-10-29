import {
  CalendarDays,
  Clock,
  MapPin,
  Trophy,
  Volleyball,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Tournament, TrainingSession } from "../../api";
import {
  formatWeekRange,
  monthGridDays,
  toISODate,
  weekGridDays,
} from "../../utils/calendar";
import { formatTrainingTime, isPrivateSession } from "../../utils/training";
import CalendarEvent from "../calendar/CalendarEvent";
import CalendarGrid from "../calendar/CalendarGrid";
import CalendarToolbar from "../calendar/CalendarToolbar";

/**
 * The agenda's location filter. "25km" keeps only events whose canonical venue
 * lies within 25 km of the point the page is anchored to — the searched
 * location when there is one, otherwise the detected one.
 */
export type LocalEventRadius = "all" | "25km";

interface UpcomingAgendaProps {
  trainingSessions: TrainingSession[];
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  cursor: Date;
  range: "month" | "week";
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  onRangeChange: (range: "month" | "week") => void;
  showMyTournaments?: boolean;
  onShowMyTournamentsChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showMyTraining?: boolean;
  onShowMyTrainingChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  localEventRadius?: LocalEventRadius;
  onLocalEventRadiusChange?: (value: LocalEventRadius) => void;
}

type AgendaItem =
  | { kind: "training"; startsAt: string; session: TrainingSession }
  | { kind: "tournament"; startsAt: string; tournament: Tournament };

function dateParts(iso: string, timeZone?: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function dateKey(iso: string, timeZone?: string): string {
  const parts = dateParts(iso, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function tournamentTime(tournament: Tournament): string {
  if (tournament.all_day) return "All day";
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tournament.timezone,
  };
  const start = new Intl.DateTimeFormat("en-US", options).format(
    new Date(tournament.starts_at),
  );
  const end = new Intl.DateTimeFormat("en-US", options).format(
    new Date(tournament.ends_at),
  );
  return `${start} – ${end}`;
}

function trainingLocation(session: TrainingSession): string | null {
  const venue = session.canonical_location?.name ?? session.location;
  return [venue, session.location_detail].filter(Boolean).join(" · ") || null;
}

function tournamentLocation(tournament: Tournament): string | null {
  const venue = tournament.location?.name ?? tournament.location_name;
  return (
    [venue, tournament.location_detail].filter(Boolean).join(" · ") || null
  );
}

function itemsByDayFor(
  trainingSessions: TrainingSession[],
  tournaments: Tournament[],
  visibleDays: Date[],
): Map<string, AgendaItem[]> {
  const visibleKeys = new Set(visibleDays.map(toISODate));
  const items: AgendaItem[] = [
    ...trainingSessions.map(
      (session): AgendaItem => ({
        kind: "training",
        startsAt: session.starts_at,
        session,
      }),
    ),
    ...tournaments.map(
      (tournament): AgendaItem => ({
        kind: "tournament",
        startsAt: tournament.starts_at,
        tournament,
      }),
    ),
  ].sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  const grouped = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const timeZone =
      item.kind === "tournament" ? item.tournament.timezone : undefined;
    const key = dateKey(item.startsAt, timeZone);
    if (!visibleKeys.has(key)) continue;

    const dayItems = grouped.get(key) ?? [];
    dayItems.push(item);
    grouped.set(key, dayItems);
  }

  return grouped;
}

function rangeLabel(days: Date[]): string {
  const start = days[0];
  const end = days[days.length - 1];
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export default function UpcomingAgenda({
  trainingSessions,
  tournaments,
  loading,
  error,
  cursor,
  range,
  onPrevious,
  onToday,
  onNext,
  onRangeChange,
  showMyTournaments,
  onShowMyTournamentsChange,
  showMyTraining,
  onShowMyTrainingChange,
  localEventRadius = "all",
  onLocalEventRadiusChange,
}: UpcomingAgendaProps) {
  const days = range === "month" ? monthGridDays(cursor) : weekGridDays(cursor);
  const itemsByDay = itemsByDayFor(trainingSessions, tournaments, days);
  const visibleItemCount = Array.from(itemsByDay.values()).reduce(
    (total, items) => total + items.length,
    0,
  );
  const label = rangeLabel(days);
  const title =
    range === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : formatWeekRange(days[0], days[days.length - 1]);

  return (
    <section className="home-agenda" aria-labelledby="home-agenda-title">
      <header className="home-agenda-header">
        <div>
          <span className="home-agenda-eyebrow">Schedule</span>
          <h3 id="home-agenda-title">Training & tournaments</h3>
          <div className="home-agenda-filters-mobile">
            <span className="home-agenda-filter-row">
              <label className="home-agenda-filter-label">
                <input
                  type="checkbox"
                  checked={showMyTournaments}
                  onChange={(e) => onShowMyTournamentsChange?.(e)}
                  id="mine-tournaments"
                />
                <span>
                  {showMyTournaments ? "My Tournaments" : "All Tournaments"}
                </span>
              </label>
              <label className="home-agenda-filter-label">
                <input
                  type="checkbox"
                  checked={showMyTraining}
                  onChange={(e) => onShowMyTrainingChange?.(e)}
                  id="mine-training"
                />
                <span>{showMyTraining ? "My Training" : "All Training"}</span>
              </label>
              <label className="home-agenda-filter-label">
                <input
                  type="checkbox"
                  checked={localEventRadius === "25km"}
                  onChange={(e) =>
                    onLocalEventRadiusChange?.(e.target.checked ? "25km" : "all")
                  }
                  id="local-events"
                />
                <span>Within 25 km</span>
              </label>
            </span>
          </div>
        </div>
        <CalendarDays size={20} aria-hidden="true" />
      </header>

      <CalendarToolbar
        title={title}
        subtitle={label}
        options={[
          { value: "month", label: "Month" },
          { value: "week", label: "Week" },
        ]}
        value={range}
        onChange={onRangeChange}
        tabsAriaLabel="Calendar range"
        onPrevious={onPrevious}
        onToday={onToday}
        onNext={onNext}
        className="home-agenda-nav"
      />

      {loading ? (
        <p className="home-agenda-state" role="status">
          Loading upcoming events…
        </p>
      ) : error ? (
        <p className="home-agenda-state home-agenda-error" role="alert">
          Upcoming events are temporarily unavailable. {error}
        </p>
      ) : (
        <div className="home-agenda-calendar">
          {visibleItemCount === 0 && (
            <p className="home-agenda-state">
              No training sessions or tournaments are scheduled in this period.
            </p>
          )}
          <CalendarGrid
            days={days}
            itemsByDay={itemsByDay}
            cursor={cursor}
            range={range}
            todayKey={toISODate(new Date())}
            className="home-calendar"
            ariaLabel={`${label} training and tournament calendar`}
            renderItem={(item, key) => {
              if (item.kind === "training") {
                const location = trainingLocation(item.session);
                return (
                  <CalendarEvent
                    key={`training-${item.session.id}-${key}`}
                    to={`/training/${item.session.id}`}
                    className="home-agenda-item home-agenda-item--training"
                    icon={<Volleyball size={14} />}
                    eyebrow={
                      <>
                        Training
                        {isPrivateSession(item.session) ? " · Private" : ""}
                        {item.session.training_series_id ? " · Recurring" : ""}
                      </>
                    }
                    title={item.session.title}
                    details={
                      <>
                        <span className="home-agenda-fact">
                          <Clock size={12} aria-hidden="true" />
                          {formatTrainingTime(
                            item.session.starts_at,
                            item.session.ends_at,
                          )}
                        </span>
                        {location && (
                          <span className="home-agenda-fact">
                            <MapPin size={12} aria-hidden="true" />
                            {location}
                          </span>
                        )}
                      </>
                    }
                  />
                );
              }

              const location = tournamentLocation(item.tournament);
              return (
                <CalendarEvent
                  key={`tournament-${item.tournament.id}-${key}`}
                  to={`/tournaments/${item.tournament.id}`}
                  className="home-agenda-item home-agenda-item--tournament"
                  icon={<Trophy size={14} />}
                  eyebrow="Tournament"
                  title={item.tournament.name}
                  details={
                    <>
                      <span className="home-agenda-fact">
                        <Clock size={12} aria-hidden="true" />
                        {tournamentTime(item.tournament)}
                      </span>
                      {location && (
                        <span className="home-agenda-fact">
                          <MapPin size={12} aria-hidden="true" />
                          {location}
                        </span>
                      )}
                    </>
                  }
                />
              );
            }}
          />
        </div>
      )}

      <nav className="home-agenda-footer" aria-label="Full event calendars">
        <Link to="/training?view=calendar">View all training</Link>
        <Link to="/tournaments">View all tournaments</Link>
      </nav>
    </section>
  );
}
