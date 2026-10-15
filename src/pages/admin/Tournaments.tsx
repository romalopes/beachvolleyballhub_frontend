import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type PaginationMeta,
  type Tournament,
  type TournamentFilters,
  type TournamentOptions,
} from "../../api";
import { useAuth } from "../../auth/AuthContext";
import TournamentCard from "../../components/TournamentCard";
import TournamentFilterForm from "../../components/TournamentFilterForm";
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

  // Load tournament options for filter dropdowns
  useEffect(() => {
    if (!isAdmin) return;
    api
      .tournamentOptions()
      .then(setOptions)
      .catch(() => {});
  }, [isAdmin]);

  // Load tournaments with filters
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setError(null);

    api
      .tournaments({ ...filters, per_page: PER_PAGE })
      .then((response) => {
        if (cancelled) return;
        setTournaments(response.data);
        setMeta(response.meta);
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
    <div className="page">
      <header className="page-header">
        <h1>Tournaments</h1>
        <p>Manage all tournaments in the system.</p>
      </header>

      <TournamentFilterForm
        filters={filters}
        onChange={handleFilterChange}
        options={options ?? undefined}
      />

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {error ? null : !tournaments ? (
        <p>Loading tournaments…</p>
      ) : tournaments.length === 0 ? (
        <p>No tournaments found.</p>
      ) : (
        <>
          <div className="admin-tournaments">
            {tournaments.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                onClick={() => navigate(`/admin/tournaments/${t.id}/edit`)}
              />
            ))}
          </div>

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
        </>
      )}

      <button
        type="button"
        className="admin-btn admin-btn-add"
        onClick={() => navigate("/admin/tournaments/new")}
      >
        Add Tournament
      </button>
    </div>
  );
}