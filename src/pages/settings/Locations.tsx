import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import { api, type Location, type PaginationMeta } from "../../api";
import Pagination from "../../components/settings/Pagination";
import DeleteConfirm from "../../components/settings/DeleteConfirm";

const PER_PAGE = 20;

export default function Locations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!user?.roles?.includes("admin")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.locations({
        q: query || undefined,
        page,
        per_page: PER_PAGE,
      });
      setLocations(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, [page, query, user]);

  useEffect(() => {
    // Deferred so the fetch is not started synchronously inside the effect:
    // the setState calls it makes belong to the request, not to the mount.
    Promise.resolve().then(fetchLocations);
  }, [fetchLocations]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.destroyLocation(pendingDelete.id);
      setLocations((prev) => prev.filter((l) => l.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleteError(null);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Failed to delete location.",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Locations"
      description="Manage locations/venues."
      backTo="/settings"
      backLabel="Back to Settings"
    >
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        <Link to="/settings/locations/new" className="admin-btn admin-btn-add">
          + Add New Location
        </Link>
        <div style={{ flex: 1, maxWidth: "400px" }}>
          <label htmlFor="settings-location-search" className="search-label">
            Search locations
          </label>
          <input
            id="settings-location-search"
            className="search-input"
            type="search"
            value={query}
            onChange={handleSearch}
            placeholder="Search by name, city, or country…"
          />
        </div>
      </div>
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {!loading && !error && (
        <>
          <p className="settings-result-count">
            {meta
              ? `${meta.total} ${meta.total === 1 ? "location" : "locations"}`
              : `${locations.length} ${locations.length === 1 ? "location" : "locations"}`}
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>City / Locality</th>
                <th>Country</th>
                <th>Slug</th>
                <th>Coordinates</th>
                <th>Status</th>
                <th>Verification</th>
                <th className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td className="admin-table-name">
                    <Link
                      to={`/settings/locations/${loc.slug ?? loc.id}`}
                      className="admin-table-name-link"
                    >
                      {loc.name}
                    </Link>
                  </td>
                  <td>{loc.location_type}</td>
                  <td>{loc.locality ?? "—"}</td>
                  <td>{loc.country_code ?? "—"}</td>
                  <td>{loc.slug ?? "—"}</td>
                  <td>
                    {loc.latitude != null && loc.longitude != null ? (
                      <span title={`${loc.latitude}, ${loc.longitude}`}>
                        {loc.latitude}, {loc.longitude}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`status-badge status-${loc.status}`}>
                      {loc.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${loc.verification_status}`}
                    >
                      {loc.verification_status}
                    </span>
                  </td>
                  <td className="admin-table-actions-col">
                    <div className="admin-table-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-add"
                        onClick={() =>
                          navigate(
                            `/settings/locations/${loc.slug ?? loc.id}/edit`,
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-remove"
                        onClick={() => {
                          setPendingDelete(loc);
                          setDeleteError(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendingDelete && (
            <>
              <DeleteConfirm
                entityName={pendingDelete.name}
                warning="This action cannot be undone."
                onCancel={() => {
                  setPendingDelete(null);
                  setDeleteError(null);
                }}
                onConfirm={handleDelete}
                deleting={deleting}
                error={deleteError}
              />
            </>
          )}
          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.total_pages}
              totalItems={meta.total}
              itemsPerPage={PER_PAGE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </SettingsLayout>
  );
}
