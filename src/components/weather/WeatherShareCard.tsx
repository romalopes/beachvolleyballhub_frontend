import type { FC } from "react";

interface WeatherSnapshot {
  location_name: string;
  forecast_target_time: string | null;
  timezone: string | null;
  current: {
    temperature_c: number | null;
    feels_like_c: number | null;
    condition: string | null;
    icon_url: string | null;
    wind_kph: number | null;
    wind_gust_kph: number | null;
    wind_direction: string | null;
    humidity_percent: number | null;
    uv_index: number | null;
    precipitation_mm: number | null;
    rain_chance_percent: number | null;
  };
  forecast: Array<{
    date: string;
    max_temp_c: number;
    min_temp_c: number;
    average_temp_c: number;
    condition: string;
    icon_url: string;
    rain_chance_percent: number | null;
    max_wind_kph: number | null;
    max_wind_direction: string | null;
  }>;
  volleyball: {
    score: number | null;
    label: string;
    advice: string[];
    warnings: string[];
    safety_override: boolean;
  };
  public_url: string;
}

interface WeatherShareCardProps {
  snapshot: WeatherSnapshot;
}

const BOM_WARNINGS_URL = "https://www.bom.gov.au/";

function formatTime(isoString: string | null, timezone: string | null): string {
  if (!isoString) return "Current";
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      timeZone: timezone || undefined,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function metric(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "–";
  }
  return format(value);
}

function severityClass(label: string): string {
  return `weather-advisor--${label.toLowerCase().replace(/\\s+/g, "-")}`;
}

export const WeatherShareCard: FC<WeatherShareCardProps> = ({ snapshot }) => {
  const {
    location_name,
    forecast_target_time,
    timezone,
    current,
    forecast,
    volleyball,
    public_url,
  } = snapshot;
  const targetTime = forecast_target_time || new Date().toISOString();

  const forecastDay =
    forecast.find((d) => d.date === targetTime.split("T")[0]) || forecast[0];

  const rainChance =
    current?.rain_chance_percent ?? forecastDay?.rain_chance_percent ?? null;
  const temp =
    current?.feels_like_c ??
    current?.temperature_c ??
    forecastDay?.average_temp_c ??
    null;
  const condition = current?.condition ?? forecastDay?.condition ?? "Unknown";
  const iconUrl = current?.icon_url ?? forecastDay?.icon_url ?? null;
  const wind = current?.wind_kph ?? forecastDay?.max_wind_kph ?? null;
  const windDir =
    current?.wind_direction ?? forecastDay?.max_wind_direction ?? null;
  const gust = current?.wind_gust_kph ?? null;
  const humidity = current?.humidity_percent ?? null;
  const uv = current?.uv_index ?? null;

  const timeLabel = forecast_target_time
    ? formatTime(forecast_target_time, timezone)
    : "Current conditions";

  return (
    <div className="weather-share-card">
      <div className="weather-share-card__header">
        <div className="weather-share-card__brand">
          <svg
            className="weather-share-card__logo"
            viewBox="0 0 120 120"
            width="48"
            height="48"
            aria-hidden="true"
          >
            <circle cx="60" cy="60" r="58" fill="#0066cc" />
            <text
              x="60"
              y="72"
              textAnchor="middle"
              fontSize="50"
              fontWeight="bold"
              fill="white"
              fontFamily="system-ui, sans-serif"
            >
              🏐
            </text>
          </svg>
          <span>BeachVolleyballHub</span>
        </div>
        <span className="weather-share-card__time">{timeLabel}</span>
      </div>

      <div className="weather-share-card__location">
        <span className="weather-share-card__location-icon" aria-hidden="true">
          📍
        </span>
        <span className="weather-share-card__location-name">
          {location_name}
        </span>
      </div>

      <div className="weather-share-card__time-display">
        <span className="weather-share-card__time-label">{timeLabel}</span>
      </div>

      <div className="weather-share-card__main">
        <div className="weather-share-card__condition">
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              className="weather-share-card__icon"
              width="96"
              height="96"
            />
          )}
          <div className="weather-share-card__temp-row">
            <span className="weather-share-card__temperature">
              {metric(temp, (v) => `${Math.round(v)}°C`)}
            </span>
            <span className="weather-share-card__condition-text">
              {condition}
            </span>
          </div>
        </div>

        <div className="weather-share-card__metrics">
          <div className="weather-share-card__metric">
            <span
              className="weather-share-card__metric-icon"
              aria-hidden="true"
            >
              💨
            </span>
            <span className="weather-share-card__metric-label">Wind</span>
            <span className="weather-share-card__metric-value">
              {metric(wind, (v) => `${Math.round(v)} km/h`)}
              {windDir ? ` ${windDir}` : ""}
            </span>
            {gust && wind !== null && gust > wind && gust - wind > 15 && (
              <span className="weather-share-card__gust">
                Gusts {Math.round(gust)} km/h
              </span>
            )}
          </div>

          <div className="weather-share-card__metric">
            <span
              className="weather-share-card__metric-icon"
              aria-hidden="true"
            >
              🌧️
            </span>
            <span className="weather-share-card__metric-label">Rain</span>
            <span className="weather-share-card__metric-value">
              {metric(rainChance, (v) => `${Math.round(v)}%`)}
            </span>
          </div>

          <div className="weather-share-card__metric">
            <span
              className="weather-share-card__metric-icon"
              aria-hidden="true"
            >
              ☀️
            </span>
            <span className="weather-share-card__metric-label">UV Index</span>
            <span className="weather-share-card__metric-value">
              {metric(uv, (v) => v.toFixed(1))}
            </span>
          </div>

          <div className="weather-share-card__metric">
            <span
              className="weather-share-card__metric-icon"
              aria-hidden="true"
            >
              💧
            </span>
            <span className="weather-share-card__metric-label">Humidity</span>
            <span className="weather-share-card__metric-value">
              {metric(humidity, (v) => `${Math.round(v)}%`)}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`weather-share-card__advisor ${severityClass(volleyball.label)}`}
      >
        <div className="weather-share-card__advisor-score">
          <span className="weather-share-card__advisor-label">
            {volleyball.label}
          </span>
          <span className="weather-share-card__advisor-value">
            {volleyball.score === null
              ? "No data"
              : `${volleyball.score}/100 for beach volleyball`}
          </span>
        </div>
        <p className="weather-share-card__advisor-note">
          Playing-suitability estimate for coaching — not an official safety
          rating.
        </p>

        {volleyball.warnings.length > 0 && (
          <div className="weather-share-card__warnings">
            {volleyball.warnings.map((warning, i) => (
              <p key={i} className="weather-share-card__warning" role="alert">
                ⚠️ {warning}
              </p>
            ))}
          </div>
        )}

        {volleyball.advice.length > 0 && (
          <ul className="weather-share-card__advice">
            {volleyball.advice.map((tip, i) => (
              <li key={i}>💡 {tip}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="weather-share-card__footer">
        <span className="weather-share-card__url">{public_url}</span>
        <span className="weather-share-card__attribution">
          Weather data:{" "}
          <a
            href="https://www.weatherapi.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            WeatherAPI.com
          </a>
          · Warnings:{" "}
          <a href={BOM_WARNINGS_URL} target="_blank" rel="noopener noreferrer">
            BOM
          </a>
        </span>
      </div>
    </div>
  );
};

export default WeatherShareCard;
