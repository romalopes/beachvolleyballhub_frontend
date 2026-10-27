import type { FormEventHandler } from "react";
import { MapPin } from "lucide-react";
import LocationMap from "./LocationMap";

interface HomeLocationPanelProps {
  heading: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearch: FormEventHandler<HTMLFormElement>;
  showUseMyLocation: boolean;
  onUseMyLocation: () => void;
  loading: boolean;
  error: string | null;
  description: string;
  mapName: string;
  mapLatitude: number | null;
  mapLongitude: number | null;
  mapQuery: string;
}

export default function HomeLocationPanel({
  heading,
  searchValue,
  onSearchValueChange,
  onSearch,
  showUseMyLocation,
  onUseMyLocation,
  loading,
  error,
  description,
  mapName,
  mapLatitude,
  mapLongitude,
  mapQuery,
}: HomeLocationPanelProps) {
  return (
    <div className="home-location-panel">
      <div className="home-location-header">
        <MapPin size={20} aria-hidden="true" />
        <h2>{heading}</h2>
      </div>

      <form className="home-location-search" onSubmit={onSearch}>
        <label htmlFor="home-location-search">Search for a location</label>
        <div className="home-location-search-controls">
          <input
            id="home-location-search"
            type="search"
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            placeholder="City, suburb, beach, or address"
          />
          <button type="submit" className="admin-btn admin-btn-add">
            Search
          </button>
          {showUseMyLocation && (
            <button type="button" className="admin-btn" onClick={onUseMyLocation}>
              Use my location
            </button>
          )}
        </div>
      </form>

      {loading && <p className="home-location-loading">Detecting your location…</p>}
      {error && (
        <p className="home-location-error" role="alert">
          {error} Showing featured venue.
        </p>
      )}
      <p className="home-location-text">{description}</p>

      <LocationMap
        name={mapName}
        latitude={mapLatitude}
        longitude={mapLongitude}
        externalUrl={null}
        query={mapQuery}
      />
    </div>
  );
}