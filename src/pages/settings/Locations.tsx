import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { MapPin, Plus, UserCircle } from "lucide-react";
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
  const [locationBusy, setLocationBusy] = useState<number | null>(null);
  const canOverseeLocations = user?.roles?.some(
    (role) => role === "admin" || role === "curator",
  );
  // Tab views. Regular users toggle between the public catalogue and their own
  // proposals — `created_by_me` is only sent for the proposals view, since on
  // the API it switches the index to "only rows I proposed". The BVBH team
  // (admin/curator) additionally gets the moderation queues: every proposed
  // row awaiting verification, every rejected row, and the inactive
  // (archived) venues.
  type LocationView =
    | "public"
    | "mine"
    | "all"
    | "proposed"
    | "rejected"
    | "archived";
  const [view, setView] = useState<LocationView>(
    canOverseeLocations ? "all" : "public",
  );

  const switchView = (next: LocationView) => {
    setView(next);
    setPage(1);
  };

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (canOverseeLocations) {
        // Oversight views: the whole catalogue, or one moderation queue.
        // The API's index supports a `verification_status` filter for
        // oversight accounts, so Proposed/Rejected are server-filtered.
        const res = await api.locations({
          q: query || undefined,
          page,
          per_page: PER_PAGE,
          // Inactive queue filters on the lifecycle status; Proposed/Rejected
          // filter on the verification status.
          status: view === "archived" ? "archived" : undefined,
          verification_status:
            view === "proposed"
              ? "proposed"
              : view === "rejected"
                ? "rejected"
                : undefined,
        });
        setLocations(res.data);
        setMeta(res.meta);
        return;
      }
      // Public view: plain index call. For non-oversight accounts the API
      // scopes it through `usable_by`, and the explicit status filters keep
      // it to the active, verified catalogue. The proposals view is the only
      // place `created_by_me` is used.
      const res =
        view === "mine"
          ? await api.locations({
              q: query || undefined,
              page,
              per_page: PER_PAGE,
              created_by_me: true,
            })
          : await api.locations({
              q: query || undefined,
              page,
              per_page: PER_PAGE,
              status: "active",
              verification_status: "verified",
            });
      setLocations(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, [canOverseeLocations, page, query, view]);

  const moderateLocation = async (
    location: Location,
    action: "verify" | "reject" | "archive" | "activate",
  ) => {
    setLocationBusy(location.id);
    setError(null);
    try {
      const updated = await {
        verify: api.verifyLocation,
        reject: api.rejectLocation,
        archive: api.archiveLocation,
        activate: api.activateLocation,
      }[action](location.id);
      setLocations((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : `Failed to ${action} location.`,
      );
    } finally {
      setLocationBusy(null);
    }
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

  useEffect(() => {
    // Search hits the API only when the box is empty (initial load / cleared)
    // or once the user has typed at least three characters. Every keystroke
    // resets the timer, so typing stays responsive without request storms.
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed.length < 3) return;
    const delay = trimmed.length === 0 ? 0 : 300;
    const timer = setTimeout(() => {
      void fetchLocations();
    }, delay);
    return () => clearTimeout(timer);
  }, [fetchLocations]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setPage(1);
  };

  if (canOverseeLocations) {
    return (
      <SettingsLayout
        title="Locations"
        description="Manage venue/location proposals and lifecycle."
      >
        <header className="organisations-library-hero">
          <div className="organisations-library-hero-copy">
            <span className="analysis-eyebrow">Location network</span>
            <h1>Locations</h1>
            <p>Browse verified venues and manage your proposals.</p>
            <div
              className="organisations-library-highlights"
              aria-label="Location directory features"
            >
              <span>
                <MapPin size={14} /> Browse public locations
              </span>
              <span>
                <UserCircle size={14} /> My proposals
              </span>
            </div>
          </div>
          <Link
            to="/locations/new"
            className="btn-primary organisations-library-create"
          >
            <Plus size={17} />
            Add New Location
          </Link>
        </header>
        <div
          className="admin-toolbar"
          role="tablist"
          aria-label="Location views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "all"}
            className={`admin-btn${view === "all" ? " admin-btn-add" : ""}`}
            onClick={() => switchView("all")}
          >
            All locations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "proposed"}
            className={`admin-btn${view === "proposed" ? " admin-btn-add" : ""}`}
            onClick={() => switchView("proposed")}
          >
            Proposed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "rejected"}
            className={`admin-btn${view === "rejected" ? " admin-btn-add" : ""}`}
            onClick={() => switchView("rejected")}
          >
            Rejected
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "archived"}
            className={`admin-btn${view === "archived" ? " admin-btn-add" : ""}`}
            onClick={() => switchView("archived")}
          >
            Inactive
          </button>
        </div>
        <div className="admin-toolbar">
          <input
            type="text"
            placeholder="Search locations…"
            value={query}
            onChange={handleSearch}
          />
        </div>
        {error && <div className="auth-flash auth-flash-error">{error}</div>}
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Coordinates</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td className="admin-table-name">
                      <Link
                        to={`/locations/${loc.slug ?? loc.id}`}
                        className="admin-table-name-link"
                      >
                        {loc.name}
                      </Link>
                    </td>
                    <td className="admin-table-type">{loc.location_type}</td>
                    <td className="admin-table-address">
                      {loc.formatted_address ?? "—"}
                    </td>
                    <td>
                      {loc.latitude != null && loc.longitude != null
                        ? `${loc.latitude}, ${loc.longitude}`
                        : "—"}
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
                        {loc.verification_status !== "verified" && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-add"
                            disabled={locationBusy === loc.id}
                            aria-label={`Verify ${loc.name}`}
                            onClick={() => void moderateLocation(loc, "verify")}
                          >
                            Verify
                          </button>
                        )}
                        {loc.verification_status === "proposed" && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-remove"
                            disabled={locationBusy === loc.id}
                            aria-label={`Reject ${loc.name}`}
                            onClick={() => void moderateLocation(loc, "reject")}
                          >
                            Reject
                          </button>
                        )}
                        {loc.status === "archived" && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-add"
                            disabled={locationBusy === loc.id}
                            aria-label={`Activate ${loc.name}`}
                            onClick={() =>
                              void moderateLocation(loc, "activate")
                            }
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-btn admin-btn-add"
                          onClick={() =>
                            navigate(`/locations/${loc.slug ?? loc.id}/edit`)
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

  // Regular user mode: read-only catalogue
  return (
    <div className="page">
      <header className="organisations-library-hero">
        <div className="organisations-library-hero-copy">
          <span className="analysis-eyebrow">Location network</span>
          <h1>Locations</h1>
          <p>
            Browse active, verified venues. Your own proposals appear under “My
            proposals”.
          </p>
          <div
            className="organisations-library-highlights"
            aria-label="Location directory features"
          >
            <span>
              <MapPin size={14} /> Browse public locations
            </span>
            <span>
              <UserCircle size={14} /> My proposals
            </span>
          </div>
        </div>
        <Link
          to="/locations/new"
          className="btn-primary organisations-library-create"
        >
          <Plus size={17} />
          Propose a Location
        </Link>
      </header>
      <div className="admin-toolbar" role="tablist" aria-label="Location views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "public"}
          className={`admin-btn${view === "public" ? " admin-btn-add" : ""}`}
          onClick={() => switchView("public")}
        >
          Public locations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "mine"}
          className={`admin-btn${view === "mine" ? " admin-btn-add" : ""}`}
          onClick={() => switchView("mine")}
        >
          My proposals
        </button>
      </div>
      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Search locations…"
          value={query}
          onChange={handleSearch}
        />
      </div>
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          {locations.length === 0 ? (
            <p>
              {view === "public"
                ? "No active, verified locations found."
                : "You have not proposed any locations yet. Propose one to get started."}
            </p>
          ) : view === "public" ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td className="admin-table-name">
                      <Link
                        to={`/locations/${loc.slug ?? loc.id}`}
                        className="admin-table-name-link"
                      >
                        {loc.name}
                      </Link>
                    </td>
                    <td className="admin-table-type">{loc.location_type}</td>
                    <td className="admin-table-address">
                      {loc.formatted_address ?? "—"}
                    </td>
                    <td>
                      {loc.latitude != null && loc.longitude != null
                        ? `${loc.latitude}, ${loc.longitude}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Coordinates</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => {
                  const canEdit = loc.verification_status !== "verified";
                  return (
                    <tr key={loc.id}>
                      <td className="admin-table-name">
                        <Link
                          to={`/locations/${loc.slug ?? loc.id}`}
                          className="admin-table-name-link"
                        >
                          {loc.name}
                        </Link>
                      </td>
                      <td>
                        {loc.latitude != null && loc.longitude != null
                          ? `${loc.latitude}, ${loc.longitude}`
                          : "—"}
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
                          {canEdit && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-add"
                              onClick={() =>
                                navigate(
                                  `/locations/${loc.slug ?? loc.id}/edit`,
                                )
                              }
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    </div>
  );
}
