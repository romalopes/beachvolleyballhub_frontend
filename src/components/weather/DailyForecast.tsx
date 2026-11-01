import type { WeatherForecastDay } from "../../api";

interface DailyForecastProps {
  forecast: WeatherForecastDay[];
  onSelectDay: (date: string) => void;
}

function dayLabel(date: string, index: number): string {
  if (index === 0) return "Today";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default function DailyForecast({
  forecast,
  onSelectDay,
}: DailyForecastProps) {
  if (forecast.length === 0) return null;

  return (
    <div className="weather-day-strip" role="list" aria-label="Daily forecast">
      {forecast.map((day, index) => {
        const label = dayLabel(day.date, index);
        const wind = day.max_wind_kph == null
          ? "—"
          : `${Math.round(day.max_wind_kph)} km/h${
              day.max_wind_direction ? ` ${day.max_wind_direction}` : ""
            }`;

        return (
          <div key={day.date} role="listitem">
            <button
              className="weather-day-card"
              type="button"
              onClick={() => onSelectDay(day.date)}
              aria-label={`View ${label} forecast, ${day.condition}, high ${Math.round(day.max_temp_c)} degrees, low ${Math.round(day.min_temp_c)} degrees, wind ${wind}`}
            >
              <span>{label}</span>
              <img src={day.icon_url} alt="" width="44" height="44" />
              <strong>{Math.round(day.max_temp_c)}°</strong>
              <small className="weather-day-low">{Math.round(day.min_temp_c)}°</small>
              <small className="weather-day-wind">{wind}</small>
            </button>
          </div>
        );
      })}
    </div>
  );
}