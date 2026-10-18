import { useCallback, useEffect, useState } from 'react';
import { fetchAllTournamentPages } from '../utils/tournaments';
import { api, type Tournament, type TournamentFilters } from '../api';

export type TournamentFilter = 'all' | 'my';

export function useTournaments(filter: TournamentFilter, baseFilters: TournamentFilters) {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const filterObj = filter === 'my' ? { mine: true } : {};
        const finalFilters = { ...baseFilters, ...filterObj };
        const loaded = await fetchAllTournamentPages(finalFilters, controller.signal, api.tournaments);
        if (!controller.signal.aborted) setTournaments(loaded);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load tournaments');
        setTournaments([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    // The async loader owns request state; rerun when filters or retry change.
    void load();

    return () => controller.abort();
  }, [filter, baseFilters, reloadKey]);

  return { tournaments, loading, error, reload };
}
