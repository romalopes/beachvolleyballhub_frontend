import type { WeatherForecastDay } from "../../api";

interface DailyForecastProps {
  forecast: WeatherForecastDay[];
}

export default function DailyForecast({ forecast }: DailyForecastProps) {
  if (forecast.length === 0) return null;

  return (
    <section className="weather-daily" aria-labelledby="weather-daily-title">
      <h4 id="weather-daily-title">Three-day forecast</h4>
      <div className="home-weather-grid">
        {forecast.map((day) => (
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
              Rain {day.rain_chance_percent === null ? "–" : `${day.rain_chance_percent}%`} · Wind{" "}
              {day.max_wind_kph === null
                ? "–"
                : `${Math.round(day.max_wind_kph)} km/h${day.max_wind_direction ? ` ${day.max_wind_direction}` : ""}`}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}