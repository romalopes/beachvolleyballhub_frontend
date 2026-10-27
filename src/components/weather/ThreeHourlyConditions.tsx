import type { WeatherForecastHour } from "../../api";

interface ThreeHourlyConditionsProps {
  conditions: WeatherForecastHour[];
  timezone: string | null;
}

function metric(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "–"
    : format(value);
}

function forecastDate(condition: WeatherForecastHour): Date {
  return new Date(condition.time_epoch * 1000);
}

export default function ThreeHourlyConditions({
  conditions,
  timezone,
}: ThreeHourlyConditionsProps) {
  if (conditions.length === 0) return null;

  const dateTimeOptions = timezone ? { timeZone: timezone } : {};

  return (
    <section className="weather-hourly" aria-labelledby="weather-hourly-title">
      <h4 id="weather-hourly-title">Next 24 hours</h4>
      <div
        className="weather-hourly-scroll"
        role="list"
        aria-labelledby="weather-hourly-title"
      >
        {conditions.map((condition) => {
          const date = forecastDate(condition);
          const day = new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            ...dateTimeOptions,
          }).format(date);
          const time = new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
            ...dateTimeOptions,
          }).format(date);
          const wind = metric(condition.wind_kph, (value) =>
            `${Math.round(value)} km/h${condition.wind_direction ? ` ${condition.wind_direction}` : ""}`,
          );

          return (
            <article
              className="weather-hourly-card"
              key={`${condition.time_epoch}-${condition.time}`}
              role="listitem"
              aria-label={`${day} ${time}, ${condition.condition ?? "unknown conditions"}`}
            >
              <time dateTime={condition.time}>{day} {time}</time>
              {condition.icon_url && (
                <img src={condition.icon_url} alt="" width={48} height={48} />
              )}
              <strong>{metric(condition.temperature_c, (value) => `${Math.round(value)}°C`)}</strong>
              <span>{condition.condition ?? "Unknown conditions"}</span>
              <span>
                Feels {metric(condition.feels_like_c, (value) => `${Math.round(value)}°C`)}
              </span>
              <span>
                Rain {metric(condition.rain_chance_percent, (value) => `${Math.round(value)}%`)}
              </span>
              <span>Wind {wind}</span>
              <span>
                Gusts {metric(condition.wind_gust_kph, (value) => `${Math.round(value)} km/h`)}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}