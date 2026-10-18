import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type Organisation,
  type PaginationMeta,
  type Tournament,
  type TournamentFilters,
  type TournamentOptions,
} from "../../api";
import { useAuth } from "../../auth/AuthContext";
import TournamentCard from "../../components/TournamentCard";
import TournamentFilterForm from "../../components/TournamentFilterForm";
import TournamentList from "../../components/TournamentList";
import Pagination from "../../components/settings/Pagination";

const PER_PAGE = 20;

export default function AdminTournamentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin =
    user?.roles?.includes("admin") &&
    !(user as { real_admin?: unknown }).real_admin;
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filters, setFilters] = useState<TournamentFilters>({});
  const [options, setOptions] = useState<TournamentOptions | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);

  // Load tournament options for filter dropdowns
  useEffect(() => {
    if (!isAdmin) return;
    api
      .tournamentOptions()
      .then(setOptions)
      .catch(() => {});
    api
      .organisations("active", undefined, true)
      .then((response) => setOrganisations(response.data))
      .catch(() => {});
  }, [isAdmin]);

  // Load tournaments with filters
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    api
      .tournaments({ ...filters, per_page: PER_PAGE })
      .then((response) => {
        if (cancelled) return;
        setTournaments(response.data);
        setMeta(response.meta);
        // Clear a previous failure only once a fresh load succeeded, so the
        // message stays up while the retry is still in flight.
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load tournaments.");
        setTournaments(null);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, isAdmin]);

  const handleFilterChange = (changes: Partial<TournamentFilters>) => {
    // The filter form sends only what changed, so merge — and always fall back
    // to the first page when the criteria change.
    setFilters((prev) => ({ ...prev, ...changes, page: changes.page ?? 1 }));
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <div className="page admin-tournaments-page">
      <header className="page-header">
        <h1>Tournaments</h1>
        <p>Manage all tournaments in the system.</p>
      </header>

      <TournamentFilterForm
        filters={filters}
        onChange={handleFilterChange}
        options={options ?? undefined}
        organisations={organisations}
      />

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      <TournamentList
        filter="all"
        baseFilters={filters}
        showCreateButton={true}
        className="admin-tournaments"
        tournaments={tournaments}
      />
      {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.total_pages}
              totalItems={meta.total}
              itemsPerPage={PER_PAGE}
              onPageChange={(next) =>
                setFilters((prev) => ({ ...prev, page: next }))
              }
            />
          )}
        </div>
  );
}