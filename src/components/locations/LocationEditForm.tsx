import { useState } from "react";
import {
  api,
  ApiValidationError,
  type Location,
  type LocationInput,
  type LocationType,
} from "../../api";

interface LocationEditFormProps {
  idPrefix: string;
  location: Location;
  onUpdated: (location: Location) => void;
  onCancel: () => void;
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

const initialInput = (location: Location): LocationInput => ({
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

export default function LocationEditForm({
  idPrefix,
  location,
  onUpdated,
  onCancel,
}: LocationEditFormProps) {
  const [input, setInput] = useState<LocationInput>(initialInput(location));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof LocationInput>(key: K, value: LocationInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  const update = async () => {
    if (!input.name.trim()) {
      setErrors(["Name is required"]);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const updated = await api.updateLocation(location.id, {
        ...input,
        name: input.name.trim(),
        country_code: input.country_code?.trim().toUpperCase() || null,
      });
      onUpdated(updated);
    } catch (error) {
      setErrors(
        error instanceof ApiValidationError
          ? error.errors
          : [error instanceof Error ? error.message : "Could not update location"],
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-form-section" aria-label="Edit location">
      <h3>Edit location</h3>
      <p className="field-hint">
        Update the venue details. Changing the address re-resolves coordinates;
        setting latitude/longitude reverse-geocodes the address.
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
          <input
            id={`${idPrefix}-location-country`}
            value={input.country_code ?? ""}
            maxLength={2}
            placeholder="AU"
            onChange={(event) => set("country_code", event.target.value)}
          />
        </div>
      </div>
      <div className="admin-field">
        <label htmlFor={`${idPrefix}-location-timezone`}>Timezone</label>
        <input
          id={`${idPrefix}-location-timezone`}
          value={input.timezone ?? ""}
          onChange={(event) => set("timezone", event.target.value)}
        />
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
        <button type="button" className="admin-btn" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="admin-btn admin-btn-add" disabled={saving} onClick={update}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}