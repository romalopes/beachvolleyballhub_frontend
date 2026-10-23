import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TournamentCard from "./TournamentCard";
import { useTournaments } from "../hooks/useTournaments";
import type { Tournament, TournamentFilters } from "../api";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import { tournamentsByWeek } from "../utils/tournaments";

type TournamentListProps = {
  filter: "all" | "my";
  baseFilters: TournamentFilters;
  className?: string;
  /** Optional override: if provided, internal fetching is skipped and these tournaments are rendered instead. */
  tournaments?: Tournament[] | null;
  /** Group the tournaments into calendar weeks, the way the training list does. */
  groupByWeek?: boolean;
};

export default function TournamentList({
  filter,
  baseFilters,
  className = "",
  tournaments: propTournaments,
  groupByWeek = false,
}: TournamentListProps) {
  const navigate = useNavigate();
  const { tournaments, loading, error, reload } = useTournaments(
    filter,
    baseFilters,
  );

  // If a parent supplies tournaments (e.g. admin with pagination), use those instead of fetching.
  const data = propTournaments ?? tournaments;

  const containerClass = filter === "my" ? "my-tournaments" : "tournament-list";
  const classNames = [containerClass, className].filter(Boolean).join(" ");

  const weekGroups = useMemo(
    () => (groupByWeek ? tournamentsByWeek(data ?? []) : []),
    [data, groupByWeek],
  );

  const renderCard = (tournament: Tournament) => (
    <TournamentCard
      key={tournament.id}
      tournament={tournament}
      onClick={() => navigate(`/tournaments/${tournament.id}`)}
    />
  );

  return (
    <div className={classNames}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data && data.length > 0 ? (
        groupByWeek ? (
          <div className="tournament-weeks">
            {weekGroups.map((group) => (
              <section
                key={group.key}
                className="tournament-week"
                aria-label={group.label}
              >
                <h3 className="tournament-week-heading">{group.label}</h3>
                <div className="tournament-cards-grid">
                  {group.tournaments.map(renderCard)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="tournaments-grid">
            {data.map(renderCard)}
          </div>
        )
      ) : (
        <EmptyState
          title={
            filter === "my" ? "No tournaments yet" : "No tournaments found"
          }
          description={
            filter === "my"
              ? "You haven't marked any tournaments as yours."
              : "No tournaments match your filters."
          }
        />
      )}
    </div>
  );
}
