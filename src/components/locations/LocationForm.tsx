import { useState } from "react";
import {
  api,
  ApiValidationError,
  type Location,
  type LocationInput,
  type LocationType,
} from "../../api";
import { countryOptions, timeZoneOptions } from "../../utils/locationOptions";

/**
 * The one venue form behind every surface that proposes or edits a location:
 * /locations/new, the edit page, organisation dashboards, tournament and
 * training forms. Every field and both dropdowns live here once; the `mode`
 * prop switches between proposing a new venue and updating an existing one.
 */
export type LocationFormMode = "create" | "edit";

interface LocationFormProps {
  idPrefix: string;
  /** "create" proposes a new venue; "edit" updates an existing one. */
  mode: LocationFormMode;
  /** edit only: the venue being updated. */
  location?: Location;
  /** edit only: receives the saved venue. */
  onUpdated?: (location: Location) => void;
  /** edit only: cancel handler (usually back to the catalogue). */
  onCancel?: () => void;
  /** create only: receives the newly proposed venue. */
  onCreated?: (location: Location) => void | Promise<void>;
  /** create only: render collapsed behind a "Propose a new venue" button. */
  defaultExpanded?: boolean;
  /** create only: link the proposal to this organisation at birth. */
  organisationId?: number | null;
  /** create only: Cancel navigates here instead of folding the form. */
  navigate?: (to: string) => void;
}

const LOCATION_TYPES: Array<{ value: LocationType; label: string }> = [
  { value: "beach", label: "Beach" },
  { value: "sports_venue", label: "Sports venue" },
  { value: "park", label: "Park" },
  { value: "indoor", label: "Indoor venue" },
  { value: "club", label: "Club" },
  { value: "other", label: "Other" },
];

const toCoordinate = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** New proposals default to Australia; edits keep the stored value. */
const blankInput = (): LocationInput => ({
  name: "",
  location_type: "beach",
  formatted_address: "",
  locality: "",
  administrative_area: "",
  country_code: "AU",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  latitude: null,
  longitude: null,
});

const editInput = (location: Location): LocationInput => ({
  name: location.name,
  location_type: location.location_type,
  formatted_address: location.formatted_address ?? "",
  locality: location.locality ?? "",
  administrative_area: location.administrative_area ?? "",
  country_code: location.country_code ?? "",
  timezone: location.timezone ?? "",
  latitude: toCoordinate(location.latitude),
  longitude: toCoordinate(location.longitude),
});

export default function LocationForm({
  idPrefix,
  mode,
  location,
  onUpdated,
  onCancel,
  onCreated,
  defaultExpanded = false,
  organisationId = null,
  navigate,
}: LocationFormProps) {
  const isCreate = mode === "create";
  // Edit mode is always expanded; create mode honours defaultExpanded.
  const [expanded, setExpanded] = useState(isCreate ? defaultExpanded : true);
  const [input, setInput] = useState<LocationInput>(() =>
    isCreate || !location ? blankInput() : editInput(location),
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof LocationInput>(key: K, value: LocationInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!input.name.trim()) {
      setErrors(["Name is required"]);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      if (isCreate) {
        const created = await api.createLocation({
          ...input,
          name: input.name.trim(),
          country_code: input.country_code?.trim().toUpperCase() || null,
          organisation_id: organisationId ?? null,
        });
        await onCreated?.(created);
        setInput(blankInput());
        setExpanded(false);
      } else if (location) {
        const updated = await api.updateLocation(location.id, {
          ...input,
          name: input.name.trim(),
          country_code: input.country_code?.trim().toUpperCase() || null,
        });
        onUpdated?.(updated);
      }
    } catch (error) {
      setErrors(
        error instanceof ApiValidationError
          ? error.errors
          : [
              error instanceof Error
                ? error.message
                : isCreate
                  ? "Could not create location"
                  : "Could not update location",
            ],
      );
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <div className="admin-field">
        <button type="button" className="admin-btn" onClick={() => setExpanded(true)}>
          Propose a new venue
        </button>
      </div>
    );
  }

  return (
    <section
      className="admin-form-section"
      aria-label={isCreate ? "Propose a new venue" : "Edit location"}
    >
      <h3>{isCreate ? "Propose a new venue" : "Edit location"}</h3>
      <p className="field-hint">
        {isCreate ? (
          <>
            The venue can be selected immediately. Coordinates are resolved asynchronously
            and the proposal remains awaiting verification
            {organisationId
              ? " while only this organisation's members can see and schedule it."
              : "."}
          </>
        ) : (
          "Update the venue details. Changing the address re-resolves coordinates; setting latitude/longitude reverse-geocodes the address."
        )}
      </p>
      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-name`}>Name *</label>
          <input
            id={`${idPrefix}-location-name`}
            value={input.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-type`}>Type</label>
          <select
            id={`${idPrefix}-location-type`}
            value={input.location_type}
            onChange={(event) => set("location_type", event.target.value as LocationType)}
          >
            {LOCATION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-field">
        <label htmlFor={`${idPrefix}-location-address`}>Address</label>
        <input
          id={`${idPrefix}-location-address`}
          value={input.formatted_address ?? ""}
          onChange={(event) => set("formatted_address", event.target.value)}
        />
      </div>
      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-locality`}>City / locality</label>
          <input
            id={`${idPrefix}-location-locality`}
            value={input.locality ?? ""}
            onChange={(event) => set("locality", event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-region`}>State / region</label>
          <input
            id={`${idPrefix}-location-region`}
            value={input.administrative_area ?? ""}
            onChange={(event) => set("administrative_area", event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-country`}>Country code</label>
          <select
            id={`${idPrefix}-location-country`}
            value={input.country_code ?? ""}
            onChange={(event) => set("country_code", event.target.value)}
          >
            <option value="">—</option>
            {countryOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-field">
        <label htmlFor={`${idPrefix}-location-timezone`}>Timezone</label>
        <select
          id={`${idPrefix}-location-timezone`}
          value={input.timezone ?? ""}
          onChange={(event) => set("timezone", event.target.value)}
        >
          <option value="">—</option>
          {timeZoneOptions().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-latitude`}>Latitude</label>
          <input
            id={`${idPrefix}-location-latitude`}
            type="number"
            step="any"
            value={input.latitude != null ? input.latitude : ""}
            onChange={(event) => {
              const value = event.target.value.trim();
              set("latitude", value === "" ? null : Number(value));
            }}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-location-longitude`}>Longitude</label>
          <input
            id={`${idPrefix}-location-longitude`}
            type="number"
            step="any"
            value={input.longitude != null ? input.longitude : ""}
            onChange={(event) => {
              const value = event.target.value.trim();
              set("longitude", value === "" ? null : Number(value));
            }}
          />
        </div>
      </div>
      {errors.length > 0 && (
        <div className="auth-flash auth-flash-error" role="alert">
          {errors.join(". ")}
        </div>
      )}
      <div className="admin-form-actions">
        {isCreate ? (
          navigate ? (
            <button
              type="button"
              className="admin-btn"
              disabled={saving}
              onClick={() => navigate("/locations")}
            >
              Cancel proposal
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn"
              disabled={saving}
              onClick={() => setExpanded(false)}
            >
              Cancel proposal
            </button>
          )
        ) : (
          <button type="button" className="admin-btn" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="admin-btn admin-btn-add" disabled={saving} onClick={submit}>
          {saving
            ? isCreate
              ? "Creating…"
              : "Saving…"
            : isCreate
              ? "Create venue proposal"
              : "Save changes"}
        </button>
      </div>
      </section>
  );
}