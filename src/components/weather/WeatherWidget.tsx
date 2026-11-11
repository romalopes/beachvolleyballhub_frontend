import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { Share2 } from "lucide-react";
import type { WeatherResponse } from "../../api";
import { AuthContext } from "../../auth/AuthContext";
import DailyForecast from "./DailyForecast";
import WeatherForecastModal from "./WeatherForecastModal";
import WeatherShareDialog from "./WeatherShareDialog";

interface WeatherWidgetProps {
  weather: WeatherResponse | null;
  loading: boolean;
  error: string | null;
  findingLocation?: boolean;
  searchError?: string | null;
  locationName: string;
  showHourly?: boolean;
}

const BOM_WARNINGS_URL = "https://www.bom.gov.au/";

function metric(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "–";
  return format(value);
}

function severityClass(label: string): string {
  return `weather-advisor--${label.toLowerCase().replace(/\s+/g, "-")}`;
}

function Advisor({ weather }: { weather: WeatherResponse }) {
  const user = useContext(AuthContext)?.user ?? null;
  const volleyball = weather.volleyball;
  if (!volleyball) return null;

  return (
    <div className={`weather-advisor ${severityClass(volleyball.label)}`}>
      <div className="weather-advisor-score">
        <span className="weather-advisor-label">{volleyball.label}</span>
        <span className="weather-advisor-value">
          {volleyball.score === null
            ? "No data"
            : `${volleyball.score}/100 for beach volleyball`}
        </span>
      </div>
      <p className="weather-advisor-note">
        Playing-suitability estimate for coaching — not an official safety
        rating.
      </p>
      {user && (
        <Link
          to="/account#weather-advisor-preferences"
          className="weather-advisor-configure"
        >
          Configure Weather Preferences
        </Link>
      )}
      {volleyball.warnings.map((warning) => (
        <p className="weather-warning" role="alert" key={warning}>
          {warning}
        </p>
      ))}
      {volleyball.advice.length > 0 && (
        <ul className="weather-advice">
          {volleyball.advice.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WeatherWidget({
  weather,
  loading,
  error,
  findingLocation = false,
  searchError = null,
  locationName,
}: WeatherWidgetProps) {
  const [forecastDate, setForecastDate] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const forecast = Array.isArray(weather?.forecast) ? weather.forecast : [];
  const hourly = Array.isArray(weather?.hourly) ? weather.hourly : [];
  const current = weather?.current ?? null;
  const attribution = weather?.attribution;
  const updated = weather?.updated_at
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(weather.updated_at))
    : null;

  const openForecast = (date = forecast[0]?.date) => {
    if (date) setForecastDate(date);
  };

  return (
    <section className="home-weather" aria-labelledby="home-weather-title">
      <div className="home-weather-header">
        <h3 id="home-weather-title">Beach volleyball weather</h3>
        {updated && (
          <span className="home-weather-freshness">Updated {updated}</span>
        )}
        {weather && !loading && !error && (
          <button
            className="weather-share-btn"
            type="button"
            onClick={() => setShareDialogOpen(true)}
            aria-label="Share weather conditions"
            disabled={loading}
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
        )}
      </div>

      {findingLocation && (
        <p className="home-weather-status" role="status">
          Finding that location…
        </p>
      )}
      {searchError && (
        <p className="home-weather-error" role="alert">
          Weather is unavailable for this search. {searchError}
        </p>
      )}
      {loading && (
        <p className="home-weather-status" role="status">
          Loading weather…
        </p>
      )}
      {error && (
        <p className="home-weather-error" role="alert">
          Weather is temporarily unavailable. {error}
        </p>
      )}

      {weather && (
        <>
          {current && (
            <div className="weather-box">
              <div className="weather-now">
                <div className="weather-now-copy">
                  <span>Today (Now)</span>
                  <strong>
                    {metric(
                      current.temperature_c,
                      (value) => `${Math.round(value)}°`,
                    )}
                  </strong>
                  <p>{current.condition ?? "Unknown conditions"}</p>
                  <small>In {locationName}</small>
                </div>
                {current.icon_url && (
                  <img src={current.icon_url} alt="" width="92" height="92" />
                )}
                <dl className="weather-now-metrics">
                  <div>
                    <dt>Wind</dt>
                    <dd>
                      {metric(
                        current.wind_kph,
                        (value) => `${Math.round(value)} km/h`,
                      )}
                      {current.wind_direction
                        ? ` ${current.wind_direction}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Gusts</dt>
                    <dd>
                      {metric(
                        current.wind_gust_kph,
                        (value) => `${Math.round(value)} km/h`,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Humidity</dt>
                    <dd>
                      {metric(
                        current.humidity_percent,
                        (value) => `${Math.round(value)}%`,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>UV</dt>
                    <dd>
                      {metric(current.uv_index, (value) => value.toFixed(1))}
                    </dd>
                  </div>
                  <div>
                    <dt>Precipitation</dt>
                    <dd>
                      {metric(
                        current.precipitation_mm,
                        (value) => `${value.toFixed(1)} mm`,
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="weather-more">
                <DailyForecast forecast={forecast} onSelectDay={openForecast} />
                {forecast.length > 0 && (
                  <button
                    className="weather-view-forecast"
                    type="button"
                    onClick={() => openForecast()}
                  >
                    View forecast
                  </button>
                )}
              </div>
            </div>
          )}

          <Advisor weather={weather} />
          {attribution?.url && attribution.name && (
            <p className="home-weather-attribution">
              Weather data provided by{" "}
              <a href={attribution.url} target="_blank" rel="noreferrer">
                {attribution.name}
              </a>{" "}
              · Official warnings:{" "}
              <a href={BOM_WARNINGS_URL} target="_blank" rel="noreferrer">
                Bureau of Meteorology
              </a>
            </p>
          )}

          {forecastDate && forecast.length > 0 && (
            <WeatherForecastModal
              current={current}
              forecast={forecast}
              hourly={hourly}
              initialDate={forecastDate}
              locationName={locationName}
              timezone={weather.location?.timezone ?? null}
              onClose={() => setForecastDate(null)}
            />
          )}

          <WeatherShareDialog
            isOpen={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
            latitude={weather.location?.latitude ?? 0}
            longitude={weather.location?.longitude ?? 0}
            locationName={locationName}
            forecastTargetTime={forecastDate}
          />
        </>
      )}
    </section>
  );
}
