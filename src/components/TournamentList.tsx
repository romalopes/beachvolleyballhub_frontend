import { useNavigate } from 'react-router-dom';
import TournamentCard from './TournamentCard';
import { useTournaments } from '../hooks/useTournaments';
import type { Tournament, TournamentFilters } from '../api';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

type TournamentListProps = {
  filter: 'all' | 'my';
  baseFilters: TournamentFilters;
  showCreateButton?: boolean;
  className?: string;
  /** Optional override: if provided, internal fetching is skipped and these tournaments are rendered instead. */
  tournaments?: Tournament[] | null;
};

export default function TournamentList({
  filter,
  baseFilters,
  showCreateButton = false,
  className = '',
  tournaments: propTournaments,
}: TournamentListProps) {
  const navigate = useNavigate();
  const { tournaments, loading, error, reload } = useTournaments(filter, baseFilters);

  // If a parent supplies tournaments (e.g. admin with pagination), use those instead of fetching.
  const data = propTournaments ?? tournaments;

  const containerClass = filter === 'my' ? 'my-tournaments' : 'tournament-list';
  const classNames = [containerClass, className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      {showCreateButton && (
        <div className="tournament-list-actions">
          <button
            className="admin-btn admin-btn-add settings-add-btn"
            onClick={() => navigate('/admin/tournaments/new')}
          >
            Create Tournament
          </button>
        </div>
      )}
      {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={reload} /> : data && data.length > 0 ? (
        <div className="tournaments-grid">
          {data.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onClick={() => navigate(`/tournaments/${tournament.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={filter === 'my' ? "No tournaments yet" : "No tournaments found"}
          description={filter === 'my' ? "You haven't marked any tournaments as yours." : "No tournaments match your filters."}
        />
      )}
    </div>
  );
}
