import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Star } from "lucide-react";
import {
  api,
  type Location,
  type Organisation,
  type OrganisationLocation,
} from "../../api";

interface OrganisationLocationsProps {
  organisation: Organisation;
  /** Called after the default changes so the parent can refresh the record. */
  onOrganisationUpdated: (organisation: Organisation) => void;
}

const locationLabel = (location: Location): string =>
  [location.name, location.locality].filter(Boolean).join(" — ");

/**
 * The venues an organisation uses, and the one it defaults to.
 *
 * Attaching a venue and marking it the default are deliberately separate acts:
 * the server refuses a default that the organisation has not attached, so the
 * order here is attach first, then set the default.
 */
export default function OrganisationLocations({
  organisation,
  onOrganisationUpdated,
}: OrganisationLocationsProps) {
  const [attached, setAttached] = useState<OrganisationLocation[]>([]);
  const [candidates, setCandidates] = useState<Location[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Only the organisation's own officers may change this list, and the server
  // is the authority on that — `can_edit` mirrors the same judgement.
  const canEdit = organisation.can_edit;

  const load = useCallback(async () => {
    try {
      const result = await api.organisationLocations(organisation.id);
      setAttached(result.locations);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to load the locations.",
      );
    } finally {
      setLoading(false);
    }
  }, [organisation.id]);

  useEffect(() => {
    // Deferred so the fetch is not started synchronously inside the effect:
    // the setState calls it makes belong to the request, not to the mount.
    Promise.resolve().then(load);
  }, [load]);

  // Candidates for attachment: only active, verified venues qualify, and the
  // server refuses anything else. An empty query lists the catalogue; a typed
  // one narrows it server-side, because a club may have hundreds of venues
  // and a dropdown of all of them is unusable.
  const queryActive = query.trim().length >= 2;
  useEffect(() => {
    let cancelled = false;
    api
      .locations({
        q: queryActive ? query.trim() : undefined,
        verification_status: "verified",
        status: "active",
        per_page: 100,
      })
      .then((result) => {
        if (!cancelled) setCandidates(result.data);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query, queryActive]);

  const attachedIds = useMemo(
    () => new Set(attached.map((row) => row.id)),
    [attached],
  );
  const attachable = candidates.filter((row) => !attachedIds.has(row.id));

const attach = async (location: Location) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.createOrganisationLocation(organisation.id, location.id);
      await load();
      setNotice(`${location.name} attached to ${organisation.name}.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The location could not be attached.",
      );
    } finally {
      setBusy(false);
    }
  };

  const detach = async (row: OrganisationLocation) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.destroyOrganisationLocation(organisation.id, row.association_id);
      await load();
      setNotice(`${row.name} removed from ${organisation.name}.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The location could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (row: OrganisationLocation) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.updateOrganisation(organisation.id, {
        default_location_id: row.id,
      });
      onOrganisationUpdated(saved);
      await load();
      setNotice(`${row.name} is now the default location.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The default location could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  };
return (
    <section className="detail-section" aria-label="Locations">
      <div className="organisations-detail-section-head">
        <h2>Locations</h2>
      </div>
      <p className="field-hint">
        The venues this organisation uses. The default location pre-fills the
        venue of new tournaments and training sessions.
      </p>

      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {notice && !error && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="field-hint">Loading locations…</p>
      ) : attached.length === 0 ? (
        <p className="organisations-roster-empty">
          No locations are attached to this organisation yet.
        </p>
      ) : (
        <ul className="organisations-roster-list">
          {attached.map((row) => (
            <li key={row.association_id} className="organisations-roster-row">
              <span className="organisations-roster-name">
                <MapPin size={14} aria-hidden="true" />
                {row.name}
                {row.default && (
                  <span className="organisations-roster-tag">Default venue</span>
                )}
              </span>
              <span className="organisations-roster-role">
                {row.locality ?? row.formatted_address ?? "—"}
              </span>
              {canEdit && (
                <>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy || row.default}
                    onClick={() => void setDefault(row)}
                  >
                    <Star size={14} aria-hidden="true" />
                    {row.default ? "Default" : "Set as default"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    disabled={busy || row.default}
                    onClick={() => void detach(row)}
                    title={
                      row.default
                        ? "The default location cannot be removed"
                        : undefined
                    }
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="organisations-add">
          <div className="form-row">
            <label htmlFor="organisation-location-search">Attach a location</label>
            <input
              id="organisation-location-search"
              type="search"
              placeholder="Search verified locations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={busy}
            />
          </div>
          {attachable.length === 0 ? (
            <p className="field-hint">
              {queryActive
                ? "No verified location matches that search."
                : "Every verified location is already attached."}
            </p>
          ) : (
            <ul className="organisations-add-results">
              {attachable.map((candidate) => (
                <li key={candidate.id}>
                  <span>{locationLabel(candidate)}</span>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy}
                    onClick={() => void attach(candidate)}
                  >
                    Attach
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
