import { CalendarDays, Clock, MapPin, Trophy, Volleyball } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tournament, TrainingSession } from "../../api";
import { formatTrainingTime, isPrivateSession } from "../../utils/training";
import CalendarEvent from "../calendar/CalendarEvent";

interface UpcomingAgendaProps {
  trainingSessions: TrainingSession[];
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  maxItems?: number;
}

type AgendaItem =
  | { kind: "training"; startsAt: string; session: TrainingSession }
  | { kind: "tournament"; startsAt: string; tournament: Tournament };

interface AgendaGroup {
  key: string;
  label: string;
  items: AgendaItem[];
}

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

function dateLabel(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
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
  return [venue, tournament.location_detail].filter(Boolean).join(" · ") || null;
}

function groupsFor(
  trainingSessions: TrainingSession[],
  tournaments: Tournament[],
  maxItems: number,
): AgendaGroup[] {
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
  ]
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, Math.max(0, maxItems));

  const groups = new Map<string, AgendaGroup>();
  for (const item of items) {
    const timeZone =
      item.kind === "tournament" ? item.tournament.timezone : undefined;
    const key = dateKey(item.startsAt, timeZone);
    const group = groups.get(key) ?? {
      key,
      label: dateLabel(item.startsAt, timeZone),
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export default function UpcomingAgenda({
  trainingSessions,
  tournaments,
  loading,
  error,
  maxItems = 6,
}: UpcomingAgendaProps) {
  const groups = groupsFor(trainingSessions, tournaments, maxItems);

  return (
    <section className="home-agenda" aria-labelledby="home-agenda-title">
      <div className="home-agenda-header">
        <div>
          <span className="home-agenda-eyebrow">Coming up</span>
          <h3 id="home-agenda-title">Training &amp; tournaments</h3>
        </div>
        <CalendarDays size={20} aria-hidden="true" />
      </div>

      {loading && groups.length === 0 ? (
        <p className="home-agenda-state" role="status">
          Loading upcoming events…
        </p>
      ) : error ? (
        <p className="home-agenda-state home-agenda-error" role="alert">
          Upcoming events are temporarily unavailable. {error}
        </p>
      ) : groups.length === 0 ? (
        <p className="home-agenda-state">
          No upcoming training sessions or tournaments are scheduled yet.
        </p>
      ) : (
        <div className="home-agenda-groups">
          {groups.map((group) => (
            <section className="home-agenda-group" key={group.key}>
              <h4>{group.label}</h4>
              <div className="home-agenda-items">
                {group.items.map((item) => {
                  if (item.kind === "training") {
                    const location = trainingLocation(item.session);
                    return (
                      <CalendarEvent
                        key={`training-${item.session.id}`}
                        to={`/training/${item.session.id}`}
                        className="home-agenda-item home-agenda-item--training"
                        icon={<Volleyball size={17} />}
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
                            <Clock size={13} aria-hidden="true" />
                            {formatTrainingTime(
                              item.session.starts_at,
                              item.session.ends_at,
                            )}
                          </span>
                          {location && (
                            <span className="home-agenda-fact">
                              <MapPin size={13} aria-hidden="true" />
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
                      key={`tournament-${item.tournament.id}`}
                      to={`/tournaments/${item.tournament.id}`}
                      className="home-agenda-item home-agenda-item--tournament"
                      icon={<Trophy size={17} />}
                      eyebrow="Tournament"
                      title={item.tournament.name}
                      details={
                        <>
                        <span className="home-agenda-fact">
                          <Clock size={13} aria-hidden="true" />
                          {tournamentTime(item.tournament)}
                        </span>
                        {location && (
                          <span className="home-agenda-fact">
                            <MapPin size={13} aria-hidden="true" />
                            {location}
                          </span>
                        )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <nav className="home-agenda-footer" aria-label="Full event calendars">
        <Link to="/training?view=calendar">View all training</Link>
        <Link to="/tournaments">View all tournaments</Link>
      </nav>
    </section>
  );
}