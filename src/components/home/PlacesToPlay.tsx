import { useCallback, useEffect, useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type NearbyOrganisation } from "../../api";

interface PlacesToPlayProps {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}

type RequestState =
  | { key: string; status: "success"; organisations: NearbyOrganisation[]; error: null }
  | { key: string; status: "error"; organisations: NearbyOrganisation[]; error: string };

const DEFAULT_RADIUS_KM = 25;
const DEFAULT_LIMIT = 6;

function locationDescription(organisation: NearbyOrganisation): string {
  const location = organisation.default_location;
  return (
    location.formatted_address ||
    [location.locality, location.administrative_area, location.country_code]
      .filter(Boolean)
      .join(", ") ||
    location.name
  );
}

function fallbackLabel(organisation: NearbyOrganisation): string {
  return organisation.acronym || organisation.name.slice(0, 2).toUpperCase();
}

export default function PlacesToPlay({
  latitude,
  longitude,
  radiusKm = DEFAULT_RADIUS_KM,
  limit = DEFAULT_LIMIT,
}: PlacesToPlayProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [request, setRequest] = useState<RequestState | null>(null);
  const requestKey = `${latitude},${longitude},${radiusKm},${limit},${retryKey}`;
  const state = request?.key === requestKey ? request : null;

  const retry = useCallback(() => setRetryKey((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    api
      .nearbyOrganisations(
        { latitude, longitude, radius_km: radiusKm, limit },
        controller.signal,
      )
      .then((response) => {
        setRequest({
          key: requestKey,
          status: "success",
          organisations: response.organisations,
          error: null,
        });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setRequest({
          key: requestKey,
          status: "error",
          organisations: [],
          error:
            reason instanceof Error
              ? reason.message
              : "Unable to load nearby places to play.",
        });
      });

    return () => controller.abort();
  }, [latitude, limit, longitude, radiusKm, requestKey, retryKey]);

  return (
    <section className="places-to-play" aria-labelledby="places-to-play-heading">
      <header className="places-to-play-header">
        <div>
          <span className="places-to-play-eyebrow">Within {radiusKm} km</span>
          <h2 id="places-to-play-heading">Places to play</h2>
        </div>
        <MapPin aria-hidden="true" />
      </header>

      {state === null && (
        <p className="places-to-play-state" role="status">
          Finding beach volleyball organisations nearby…
        </p>
      )}

      {state?.status === "error" && (
        <div className="places-to-play-state" role="alert">
          <p>{state.error}</p>
          <button type="button" className="admin-btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state?.status === "success" && state.organisations.length === 0 && (
        <p className="places-to-play-state">
          No organisations with a verified venue were found nearby.
        </p>
      )}

      {state?.status === "success" && state.organisations.length > 0 && (
        <div className="places-to-play-grid">
          {state.organisations.map((organisation) => (
            <article className="places-to-play-card" key={organisation.id}>
              {organisation.logo_url ? (
                <img
                  className="places-to-play-logo"
                  src={organisation.logo_url}
                  alt=""
                />
              ) : (
                <span
                  className="places-to-play-logo places-to-play-logo-fallback"
                  aria-hidden="true"
                >
                  {fallbackLabel(organisation)}
                </span>
              )}
              <div className="places-to-play-copy">
                <span className="places-to-play-type">
                  {organisation.organisation_type.replaceAll("_", " ")}
                </span>
                <h3>{organisation.name}</h3>
                <p className="places-to-play-venue">
                  <strong>{organisation.default_location.name}</strong>
                  <span>{locationDescription(organisation)}</span>
                </p>
                <div className="places-to-play-card-footer">
                  <span>{organisation.distance_km.toFixed(1)} km away</span>
                  <Link to={`/organisations/${organisation.slug}`}>
                    View organisation <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}