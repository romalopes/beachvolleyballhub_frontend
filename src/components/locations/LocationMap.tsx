import { ExternalLink, MapPin } from "lucide-react";

interface LocationMapProps {
  name: string;
  latitude: string | number | null;
  longitude: string | number | null;
  externalUrl: string | null;
  query?: string | null;
}

function validCoordinate(value: string | number | null, minimum: number, maximum: number) {
  if (value === null || value === "") return null;

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export default function LocationMap({
  name,
  latitude,
  longitude,
  externalUrl,
  query,
}: LocationMapProps) {
  const validLatitude = validCoordinate(latitude, -90, 90);
  const validLongitude = validCoordinate(longitude, -180, 180);
  const hasValidCoordinates = validLatitude !== null && validLongitude !== null;
  const placeQuery = hasValidCoordinates
    ? `${validLatitude},${validLongitude}`
    : query?.trim() || null;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim();

  let embedUrl: string | null = null;
  if (apiKey && placeQuery) {
    const url = new URL("https://www.google.com/maps/embed/v1/place");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", placeQuery);
    embedUrl = url.toString();
  }

  let mapUrl = externalUrl;
  if (!mapUrl && !hasValidCoordinates && placeQuery) {
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", placeQuery);
    mapUrl = url.toString();
  }

  if (!placeQuery && !mapUrl) return null;

  return (
    <div className="location-map">
      {embedUrl ? (
        <iframe
          className="location-map-frame"
          src={embedUrl}
          title={`Map of ${name}`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <p className="location-map-fallback">
          <MapPin size={18} aria-hidden="true" />
          Map preview is unavailable.
        </p>
      )}

      {mapUrl && (
        <div className="location-map-actions">
          <a href={mapUrl} target="_blank" rel="noopener noreferrer">
            Open in Google Maps <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}