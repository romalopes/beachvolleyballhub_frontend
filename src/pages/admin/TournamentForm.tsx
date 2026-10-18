import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  type Division,
  type DivisionScheme,
  type Organisation,
  type PublicationState,
  type Tournament,
  type TournamentOptions,
  type TournamentScope,
  type WatchLink,
} from "../../api";
import { useAuth } from "../../auth/AuthContext";

interface TournamentFormProps {
  initial: Tournament | null;
  onCancel: () => void;
  onSuccess: (saved: Tournament) => void;
}

interface FormState {
  name: string;
  organisation_id: string;
  description: string;
  website_url: string;
  location_name: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  scope: TournamentScope;
  division_scheme: DivisionScheme;
  publication_state: PublicationState;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

const SCOPE_LABELS: Record<TournamentScope, string> = {
  club: "Club",
  state: "State",
  national: "National",
  international: "International",
  other: "Other",
};

const SCHEME_LABELS: Record<DivisionScheme, string> = {
  letter: "Letter levels (B … AAAA)",
  numbered: "Numbered divisions (1, 2, 3 …)",
};

const PUBLICATION_LABELS: Record<PublicationState, string> = {
  draft: "Draft",
  active: "Active",
  cancelled: "Cancelled",
  archived: "Archived",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's date as "YYYY-MM-DD" in the browser's timezone. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * ISO instant → "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm") wall-clock time in the
 * tournament's timezone, matching how the API stores and re-parses the value.
 */
function formatInTimezone(
  iso: string,
  timeZone: string,
  withTime: boolean,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).formatToParts(new Date(iso));
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return withTime ? `${date}T${part("hour")}:${part("minute")}` : date;
}

/** The day after a "YYYY-MM-DD" date, computed in UTC so DST cannot shift it. */
function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default function TournamentForm({
  initial,
  onCancel,
  onSuccess,
}: TournamentFormProps) {
  const isNew = !initial;
  const { user } = useAuth();
  const [options, setOptions] = useState<TournamentOptions | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormState>(() => {
    const allDay = initial?.all_day ?? true;
    const browserTimezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const timezone = initial?.timezone ?? browserTimezone;
    const start = initial
      ? formatInTimezone(initial.starts_at, timezone, !allDay)
      : today();
    const end = initial
      ? formatInTimezone(initial.ends_at, timezone, !allDay)
      : allDay
        ? nextDay(today())
        : `${today()}T23:59`;
    return {
      name: initial?.name ?? "",
      organisation_id: initial ? String(initial.organisation.id) : "",
      description: initial?.description ?? "",
      website_url: initial?.website_url ?? "",
      location_name: initial?.location_name ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      country: initial?.country ?? "",
      timezone,
      scope: initial?.scope ?? "club",
      division_scheme: initial?.division_scheme ?? "numbered",
      publication_state: initial?.publication_state ?? "draft",
      all_day: allDay,
      starts_at: start,
      ends_at: end,
    };
  });

  useEffect(() => {
    let active = true;
    api
      .tournamentOptions()
      .then((loaded) => {
        if (active) setOptions(loaded);
      })
      .catch(() => {});
    api
      .organisations("active")
      .then((response) => {
        if (active) setOrganisations(response.data);
      })
      .catch(() => {
        // Surface the form anyway; the select then offers only an existing
        // tournament's organisation (if any) and the error surfaces on save.
        if (active) setOrganisations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleAllDayChange(allDay: boolean) {
    setFormData((prev) => {
      if (prev.all_day === allDay) return prev;
      const toTime = (value: string, fallback: string) =>
        value ? `${value.slice(0, 10)}T${fallback}` : value;
      const toDate = (value: string) => (value ? value.slice(0, 10) : value);
      return {
        ...prev,
        all_day: allDay,
        starts_at: allDay ? toDate(prev.starts_at) : toTime(prev.starts_at, "00:00"),
        ends_at: allDay ? toDate(prev.ends_at) : toTime(prev.ends_at, "23:59"),
      };
    });
  }

  function handleStartChange(value: string) {
    setFormData((prev) => {
      let ends = prev.ends_at;
      // Keep the end after the start whenever the start moves past it.
      if (value && ends && ends <= value) {
        ends = prev.all_day ? nextDay(value) : `${value.slice(0, 10)}T23:59`;
      }
      return { ...prev, starts_at: value, ends_at: ends };
    });
  }

  // --- divisions & watch links & lifecycle (edit mode only) -----------------
  const [divisions, setDivisions] = useState<Division[]>(initial?.divisions ?? []);
  const [watchLinks, setWatchLinks] = useState<WatchLink[]>(initial?.watch_links ?? []);
  const [newDivisionCode, setNewDivisionCode] = useState("");
  const [newLink, setNewLink] = useState({ name: "", url: "", provider: "youtube" });
  const [childBusy, setChildBusy] = useState<string | null>(null);
  const [childError, setChildError] = useState<string | null>(null);

  function runChildAction(key: string, action: () => Promise<void>) {
    setChildBusy(key);
    setChildError(null);
    action()
      .catch((err) =>
        setChildError(err instanceof Error ? err.message : "The action could not be completed."),
      )
      .finally(() => setChildBusy(null));
  }

  function addDivision() {
    if (!initial || formData.division_scheme !== "numbered" || !newDivisionCode.trim()) return;
    const code = newDivisionCode.trim().toUpperCase();
    const divisionNumber = Number(code);
    if (!Number.isInteger(divisionNumber) || divisionNumber < 1) return;
    const payload = { division_number: divisionNumber };
    void runChildAction("add-division", async () => {
      const division = await api.createDivision(initial.id, payload);
      setDivisions((prev) => [...prev, division]);
      setNewDivisionCode("");
    });
  }

  function toggleDivision(division: Division) {
    if (!initial) return;
    void runChildAction(`division-${division.id}`, async () => {
      const updated = await api.updateDivision(initial.id, division.id, {
        active: !division.active,
      });
      setDivisions((prev) => prev.map((d) => (d.id === division.id ? updated : d)));
    });
  }

  function removeDivision(division: Division) {
    if (!initial) return;
    void runChildAction(`division-${division.id}`, async () => {
      await api.deleteDivision(initial.id, division.id);
      setDivisions((prev) => prev.filter((d) => d.id !== division.id));
    });
  }

  function addWatchLink() {
    if (!initial || !newLink.name.trim() || !newLink.url.trim()) return;
    void runChildAction("add-link", async () => {
      const link = await api.createWatchLink(initial.id, {
        name: newLink.name.trim(),
        url: newLink.url.trim(),
        provider: newLink.provider.trim() || "other",
        starts_at: new Date().toISOString(),
      });
      setWatchLinks((prev) => [...prev, link]);
      setNewLink({ name: "", url: "", provider: "youtube" });
    });
  }

  function removeWatchLink(link: WatchLink) {
    if (!initial) return;
    void runChildAction(`link-${link.id}`, async () => {
      await api.deleteWatchLink(initial.id, link.id);
      setWatchLinks((prev) => prev.filter((l) => l.id !== link.id));
    });
  }

  function moveWatchLink(link: WatchLink, direction: -1 | 1) {
    if (!initial) return;
    void runChildAction(`link-${link.id}`, async () => {
      const updated = await api.updateWatchLink(initial.id, link.id, {
        position: link.position + direction,
      });
      setWatchLinks((prev) =>
        prev
          .map((l) => (l.id === link.id ? updated : l))
          .sort((a, b) => a.position - b.position),
      );
    });
  }

  function lifecycle(
    action: "publish" | "archive" | "cancel" | "restore" | "delete",
  ) {
    if (!initial) return;
    const confirmations: Record<string, string> = {
      cancel: "Cancel this tournament? Participants will see it as cancelled.",
      archive: "Archive this tournament? It will be hidden from public listings.",
      delete: "Delete this tournament permanently? This cannot be undone.",
    };
    const message = confirmations[action];
    if (message && !window.confirm(message)) return;
    void runChildAction(action, async () => {
      if (action === "delete") {
        await api.deleteTournament(initial.id);
        onCancel();
        return;
      }
      const saved =
        action === "publish"
          ? await api.publishTournament(initial.id)
          : action === "archive"
            ? await api.archiveTournament(initial.id)
            : action === "cancel"
              ? await api.cancelTournament(initial.id)
              : await api.restoreTournament(initial.id);
      setFormData((prev) => ({ ...prev, publication_state: saved.publication_state }));
      setDivisions(saved.divisions);
      setWatchLinks(saved.watch_links);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.organisation_id) {
      setError("Select an organisation.");
      return;
    }
    if (!formData.starts_at || !formData.ends_at) {
      setError("Start and end are required.");
      return;
    }
    if (formData.ends_at <= formData.starts_at) {
      setError(
        formData.all_day
          ? "The end date must be after the start date."
          : "The end must be after the start.",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        organisation_id: Number(formData.organisation_id),
        scope: formData.scope,
        division_scheme: formData.division_scheme,
        publication_state: formData.publication_state,
        website_url: formData.website_url.trim() || null,
        description: formData.description.trim() || null,
        location_name: formData.location_name.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        country: formData.country.trim() || null,
        timezone: formData.timezone,
        all_day: formData.all_day,
        starts_at: formData.starts_at,
        ends_at: formData.ends_at,
      };

      let saved: Tournament;
      if (isNew) {
        let accountId = user?.account_id ?? null;
        if (!accountId) accountId = (await api.account()).id;
        if (!accountId) {
          throw new Error(
            "Your account must exist before you can create a tournament.",
          );
        }
        const createPayload = {
          ...payload,
          created_by_account_id: accountId,
        };
        saved = await api.createTournament(createPayload);
      } else {
        saved = await api.updateTournament(initial!.id, payload);
      }
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tournament.");
    } finally {
      setSaving(false);
    }
  }

  if (!options || !organisations) {
    return <div className="loading">Loading…</div>;
  }

  // An existing tournament's organisation may be archived or outside the first
  // page of the picker, so keep it selectable.
  const organisationChoices =
    initial && !organisations.some((o) => o.id === initial.organisation.id)
      ? [initial.organisation, ...organisations]
      : organisations;
  const timezoneChoices = Array.from(
    new Set([formData.timezone, ...TIMEZONES]),
  );

  return (
    <form className="admin-form tournament-editor" onSubmit={handleSubmit}>
      {error && (
        <div className="auth-flash auth-flash-error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-field">
        <label htmlFor="tournament-name">Name *</label>
        <input
          id="tournament-name"
          type="text"
          value={formData.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Summer Sand Series"
          maxLength={255}
          required
        />
      </div>

      <div className="admin-field">
        <label htmlFor="tournament-organisation">Organisation *</label>
        <select
          id="tournament-organisation"
          value={formData.organisation_id}
          onChange={(e) => set("organisation_id", e.target.value)}
          required
        >
          <option value="">Select an organisation</option>
          {organisationChoices.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field tournament-editor-description">
        <label htmlFor="tournament-description">Description</label>
        <textarea
          id="tournament-description"
          value={formData.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What is this tournament about?"
          rows={4}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="tournament-website">Website</label>
        <input
          id="tournament-website"
          type="url"
          value={formData.website_url}
          onChange={(e) => set("website_url", e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="tournament-location-name">Venue</label>
        <input
          id="tournament-location-name"
          type="text"
          value={formData.location_name}
          onChange={(e) => set("location_name", e.target.value)}
          placeholder="e.g. Copacabana Beach Court 3"
        />
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="tournament-city">City</label>
          <input
            id="tournament-city"
            type="text"
            value={formData.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="tournament-state">State / Region</label>
          <input
            id="tournament-state"
            type="text"
            value={formData.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="tournament-country">Country</label>
          <input
            id="tournament-country"
            type="text"
            value={formData.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </div>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="tournament-scope">Scope</label>
          <select
            id="tournament-scope"
            value={formData.scope}
            onChange={(e) => set("scope", e.target.value as TournamentScope)}
          >
            {options.scopes.map((scope) => (
              <option key={scope} value={scope}>
                {SCOPE_LABELS[scope] ?? scope}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="tournament-scheme">Division Scheme</label>
          <select
            id="tournament-scheme"
            disabled={initial?.division_scheme === "letter"}
            value={formData.division_scheme}
            onChange={(e) =>
              set("division_scheme", e.target.value as DivisionScheme)
            }
          >
            {(initial?.division_scheme === "letter" ? ["letter"] as const : ["numbered"] as const).map((scheme) => (
              <option key={scheme} value={scheme}>
                {SCHEME_LABELS[scheme] ?? scheme}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="tournament-timezone">Timezone</label>
          <select
            id="tournament-timezone"
            value={formData.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          >
            {timezoneChoices.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="tournament-publication-state">
            Publication State
          </label>
          <select
            id="tournament-publication-state"
            value={formData.publication_state}
            onChange={(e) =>
              set("publication_state", e.target.value as PublicationState)
            }
          >
            {(Object.keys(PUBLICATION_LABELS) as PublicationState[]).map(
              (state) => (
                <option key={state} value={state}>
                  {PUBLICATION_LABELS[state]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="tournament-format">Format</label>
        <select
          id="tournament-format"
          value={formData.all_day ? "all-day" : "timed"}
          onChange={(e) => handleAllDayChange(e.target.value === "all-day")}
        >
          <option value="all-day">All day</option>
          <option value="timed">Specific times</option>
        </select>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="tournament-starts-at">
            {formData.all_day ? "Start Date *" : "Starts At *"}
          </label>
          <input
            id="tournament-starts-at"
            type={formData.all_day ? "date" : "datetime-local"}
            value={formData.starts_at}
            onChange={(e) => handleStartChange(e.target.value)}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="tournament-ends-at">
            {formData.all_day ? "End Date *" : "Ends At *"}
          </label>
          <input
            id="tournament-ends-at"
            type={formData.all_day ? "date" : "datetime-local"}
            value={formData.ends_at}
            onChange={(e) => set("ends_at", e.target.value)}
            required
          />
        </div>
      </div>

      {formData.all_day && (
        <p className="video-form-note">
          An all-day tournament needs an end date after the start date — a
          single-day event runs from its start date to the following day.
        </p>
      )}

      {!isNew && (
        <>
          <section className="admin-form-section tournament-editor-divisions">
            <h3>Divisions</h3>
            {divisions.length === 0 ? (
              <p className="video-form-note">No divisions yet.</p>
            ) : (
              <ul className="admin-child-list">
                {divisions.map((division) => (
                  <li key={division.id} className="admin-child-row">
                    <span>
                      {division.division_code}
                      {division.active ? "" : " (inactive)"}
                    </span>
                    <span className="admin-child-actions">
                      <button type="button" className="admin-btn" onClick={() => toggleDivision(division)} disabled={childBusy !== null}>
                        {division.active ? "Deactivate" : "Activate"}
                      </button>
                      <button type="button" className="admin-btn" onClick={() => removeDivision(division)} disabled={childBusy !== null}>
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {formData.division_scheme === "numbered" && <div className="admin-field-row">
              <input
                type="number"
                min={1}
                step={1}
                value={newDivisionCode}
                onChange={(e) => setNewDivisionCode(e.target.value)}
                placeholder="Number (e.g. 1, 2)"
              />
              <button type="button" className="admin-btn" onClick={addDivision} disabled={childBusy !== null || !newDivisionCode.trim()}>
                Add division
              </button>
            </div>}
          </section>

          <section className="admin-form-section">
            <h3>Watch links</h3>
            {watchLinks.length === 0 ? (
              <p className="video-form-note">No watch links yet.</p>
            ) : (
              <ul className="admin-child-list">
                {watchLinks.map((link, index) => (
                  <li key={link.id} className="admin-child-row">
                    <span>
                      {link.name} — {link.url}
                    </span>
                    <span className="admin-child-actions">
                      <button type="button" className="admin-btn" onClick={() => moveWatchLink(link, -1)} disabled={index === 0 || childBusy !== null} aria-label={`Move ${link.name} up`}>↑</button>
                      <button type="button" className="admin-btn" onClick={() => moveWatchLink(link, 1)} disabled={index === watchLinks.length - 1 || childBusy !== null} aria-label={`Move ${link.name} down`}>↓</button>
                      <button type="button" className="admin-btn" onClick={() => removeWatchLink(link)} disabled={childBusy !== null}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="admin-field-row">
              <input type="text" value={newLink.name} onChange={(e) => setNewLink((p) => ({ ...p, name: e.target.value }))} placeholder="Name (e.g. Livestream)" />
              <input type="url" value={newLink.url} onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))} placeholder="https://…" />
              <input type="text" value={newLink.provider} onChange={(e) => setNewLink((p) => ({ ...p, provider: e.target.value }))} placeholder="provider (e.g. youtube)" />
              <button type="button" className="admin-btn" onClick={addWatchLink} disabled={childBusy !== null || !newLink.name.trim() || !newLink.url.trim()}>
                Add link
              </button>
            </div>
          </section>

          <section className="admin-form-section">
            <h3>Lifecycle</h3>
            <div className="admin-form-actions">
              {formData.publication_state === "draft" && (
                <button type="button" className="admin-btn" onClick={() => lifecycle("publish")} disabled={childBusy !== null}>Publish</button>
              )}
              {(formData.publication_state === "draft" || formData.publication_state === "active") && (
                <button type="button" className="admin-btn" onClick={() => lifecycle("archive")} disabled={childBusy !== null}>Archive</button>
              )}
              {formData.publication_state === "active" && (
                <button type="button" className="admin-btn" onClick={() => lifecycle("cancel")} disabled={childBusy !== null}>Cancel tournament</button>
              )}
              {(formData.publication_state === "cancelled" || formData.publication_state === "archived") && (
                <button type="button" className="admin-btn" onClick={() => lifecycle("restore")} disabled={childBusy !== null}>Restore</button>
              )}
              <button type="button" className="admin-btn admin-btn-danger" onClick={() => lifecycle("delete")} disabled={childBusy !== null}>Delete permanently</button>
            </div>
          </section>

          {childError && (
            <div className="auth-flash auth-flash-error" role="alert">{childError}</div>
          )}
        </>
      )}

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="admin-btn admin-btn-add"
          disabled={
            saving || !formData.name.trim() || !formData.organisation_id
          }
        >
          {saving ? "Saving..." : isNew ? "Create Tournament" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}




