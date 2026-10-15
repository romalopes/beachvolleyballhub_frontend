import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  type Tournament,
  type TournamentFilters,
  type TournamentOptions,
} from '../api';
import TournamentCard from '../components/TournamentCard';
import FilterState from '../components/FilterState';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import TournamentFilterForm from '../components/TournamentFilterForm';

export default function TournamentsPage() {
  const [filters, setFilters] = useState<TournamentFilters>({});
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null); // null means loading
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<TournamentOptions | null>(null);
  const navigate = useNavigate();

  const fetchTournaments = useCallback(async () => {
    setError(null);
    try {
      const response = await api.tournaments({
        ...filters,
        page: 1,
        per_page: 100,
      });
      setTournaments(response.data);
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
      setError('Failed to load tournaments');
    }
  }, [filters]);

  // Fetch options for filter dropdowns (like scope, organisation, etc.)
  useEffect(() => {
    api.tournamentOptions()
      .then(setOptions)
      .catch((err: unknown) => {
        console.warn('Could not load tournament options:', err);
        // Not critical, we can still filter without options
      });
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  if (tournaments === null) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchTournaments} />;
  }

  if (tournaments.length === 0) {
    return (
      <div className="empty-state">
        <h3>No tournaments found</h3>
        <p>Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Tournaments</h1>
      <div className="tournaments-page-content">
        <aside className="tournaments-filters">
          <h2>Filters</h2>
          <TournamentFilterForm
            filters={filters}
            onChange={setFilters}
            options={options ?? undefined}
          />
        </aside>
        <main className="tournaments-list">
          <FilterState filters={filters} onReset={() => setFilters({})} />
          <div className="tournaments-grid">
            {tournaments.map(tournament => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onClick={() => navigate(`/tournaments/${tournament.id}`)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}