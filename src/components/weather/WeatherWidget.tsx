import type { WeatherCurrent, WeatherResponse } from "../../api";

interface WeatherWidgetProps {
  weather: WeatherResponse | null;
  loading: boolean;
  error: string | null;
  findingLocation?: boolean;
  searchError?: string | null;
  locationName: string;
}

const BOM_WARNINGS_URL = "https://www.bom.gov.au/";

function metric(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return format(value);
}

function severityClass(label: string): string {
  return `weather-advisor--${label.toLowerCase().replace(/\s+/g, "-")}`;
}

function CurrentConditions({ current }: { current: WeatherCurrent }) {
  const gustGap =
    current.wind_kph !== null &&
    current.wind_gust_kph !== null &&
    current.wind_gust_kph - current.wind_kph;

  return (
    <div className="weather-current">
      {current.icon_url && (
        <img src={current.icon_url} alt="" width={64} height={64} />
      )}
      <div className="weather-current-summary">
        <span className="weather-current-temp">
          {metric(current.temperature_c, (v) => `${Math.round(v)}°C`)}
        </span>
        <span>{current.condition ?? "Unknown conditions"}</span>
        <span>
          Feels like {metric(current.feels_like_c, (v) => `${Math.round(v)}°C`)}
        </span>
      </div>
      <dl className="weather-metrics">
        <div>
          <dt>Wind</dt>
          <dd>
            {metric(current.wind_kph, (v) => `${Math.round(v)} km/h`)}
            {current.wind_direction ? ` ${current.wind_direction}` : ""}
          </dd>
        </div>
        <div>
          <dt>Gusts</dt>
          <dd>{metric(current.wind_gust_kph, (v) => `${Math.round(v)} km/h`)}</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{metric(current.humidity_percent, (v) => `${Math.round(v)}%`)}</dd>
        </div>
        <div>
          <dt>UV</dt>
          <dd>{metric(current.uv_index, (v) => v.toFixed(1))}</dd>
        </div>
        <div>
          <dt>Precipitation</dt>
          <dd>{metric(current.precipitation_mm, (v) => `${v.toFixed(1)} mm`)}</dd>
        </div>
      </dl>
      {typeof gustGap === "number" && gustGap > 15 && (
        <p className="weather-gust-note">
          Gusty: gusts run about {Math.round(gustGap)} km/h above the mean wind.
        </p>
      )}
    </div>
  );
}

function Advisor({ weather }: { weather: WeatherResponse }) {
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
        Playing-suitability estimate for coaching — not an official safety rating.
      </p>
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
  const updated = weather?.updated_at
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(weather.updated_at))
    : null;

  return (
    <section className="home-weather" aria-labelledby="home-weather-title">
      <div className="home-weather-header">
        <div>
          <h3 id="home-weather-title">Beach volleyball weather</h3>
          <p>{locationName}</p>
        </div>
        {updated && <span className="home-weather-freshness">Updated {updated}</span>}
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
          {weather.current && <CurrentConditions current={weather.current} />}
          <Advisor weather={weather} />
          <div className="home-weather-grid">
            {weather.forecast.map((day) => (
              <article className="home-weather-card" key={day.date}>
                <time dateTime={day.date}>
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${day.date}T00:00:00Z`))}
                </time>
                <img src={day.icon_url} alt="" width="64" height="64" />
                <strong>{day.condition}</strong>
                <span>
                  {Math.round(day.max_temp_c)}° / {Math.round(day.min_temp_c)}°C
                </span>
                <span>
                  Rain{" "}
                  {day.rain_chance_percent === null ? "–" : `${day.rain_chance_percent}%`} ·
                  Wind{" "}
                  {day.max_wind_kph === null ? "–" : `${Math.round(day.max_wind_kph)} km/h`}
                </span>
              </article>
            ))}
          </div>
          <p className="home-weather-attribution">
            Weather data provided by{" "}
            <a href={weather.attribution.url} target="_blank" rel="noreferrer">
              {weather.attribution.name}
            </a>{" "}
            · Official warnings:{" "}
            <a href={BOM_WARNINGS_URL} target="_blank" rel="noreferrer">
              Bureau of Meteorology
            </a>
          </p>
        </>
      )}
    </section>
  );
}