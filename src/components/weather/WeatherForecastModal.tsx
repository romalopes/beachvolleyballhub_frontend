import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type {
  WeatherCurrent,
  WeatherForecastDay,
  WeatherForecastHour,
} from "../../api";

interface WeatherForecastModalProps {
  current: WeatherCurrent | null;
  forecast: WeatherForecastDay[];
  hourly: WeatherForecastHour[];
  initialDate: string;
  locationName: string;
  timezone: string | null;
  onClose: () => void;
}

function metric(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "–"
    : format(value);
}

function localDateKey(epoch: number, timezone: string | null): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  }).formatToParts(new Date(epoch * 1000));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function fullDayLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function shortDayLabel(date: string, index: number): string {
  if (index === 0) return "Today";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function hourLabel(hour: WeatherForecastHour, timezone: string | null): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(hour.time_epoch * 1000));
}

export default function WeatherForecastModal({
  current,
  forecast,
  hourly,
  initialDate,
  locationName,
  timezone,
  onClose,
}: WeatherForecastModalProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selectedDay =
    forecast.find((day) => day.date === selectedDate) ?? forecast[0];
  const selectedHours = useMemo(
    () =>
      hourly.filter(
        (hour) => localDateKey(hour.time_epoch, timezone) === selectedDay?.date,
      ),
    [hourly, selectedDay?.date, timezone],
  );
  const temperatures = selectedHours
    .map((hour) => hour.temperature_c)
    .filter(
      (temperature): temperature is number =>
        temperature !== null && Number.isFinite(temperature),
    );
  const minimumHourlyTemp =
    temperatures.length > 0 ? Math.min(...temperatures) : 0;
  const maximumHourlyTemp =
    temperatures.length > 0 ? Math.max(...temperatures) : 0;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!selectedDay) return null;

  const isCurrentDay = selectedDay.date === forecast[0]?.date;
  const displayTemperature = isCurrentDay
    ? current?.temperature_c
    : selectedDay.average_temp_c;
  const displayCondition = isCurrentDay
    ? current?.condition ?? selectedDay.condition
    : selectedDay.condition;
  const displayIcon = isCurrentDay
    ? current?.icon_url ?? selectedDay.icon_url
    : selectedDay.icon_url;

  return (
    <div
      className="weather-forecast-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="weather-forecast-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weather-forecast-title"
      >
        <button
          ref={closeButtonRef}
          className="weather-forecast-close"
          type="button"
          onClick={onClose}
          aria-label="Close weather forecast"
        >
          <X aria-hidden="true" size={22} />
        </button>

        <div className="weather-forecast-body">
          <header className="weather-forecast-heading">
            <p>Weather forecast</p>
            <h2 id="weather-forecast-title">{locationName}</h2>
            <span>{fullDayLabel(selectedDay.date)}</span>
          </header>

          <div className="weather-forecast-overview">
            <div className="weather-forecast-current">
              <strong>
                {metric(displayTemperature, (value) => `${Math.round(value)}°`)}
              </strong>
              {displayIcon && (
                <img src={displayIcon} alt="" width="88" height="88" />
              )}
              <span>{displayCondition ?? "Unknown conditions"}</span>
            </div>

            <dl className="weather-forecast-metrics">
              <div><dt>Minimum</dt><dd>{Math.round(selectedDay.min_temp_c)}°C</dd></div>
              <div><dt>Maximum</dt><dd>{Math.round(selectedDay.max_temp_c)}°C</dd></div>
              <div>
                <dt>Wind</dt>
                <dd>
                  {metric(selectedDay.max_wind_kph, (value) => `${Math.round(value)} km/h`)}
                  {selectedDay.max_wind_direction ? ` ${selectedDay.max_wind_direction}` : ""}
                </dd>
              </div>
              <div>
                <dt>Rain chance</dt>
                <dd>{metric(selectedDay.rain_chance_percent, (value) => `${Math.round(value)}%`)}</dd>
              </div>
              {isCurrentDay && (
                <>
                  <div><dt>Feels like</dt><dd>{metric(current?.feels_like_c, (value) => `${Math.round(value)}°C`)}</dd></div>
                  <div><dt>Humidity</dt><dd>{metric(current?.humidity_percent, (value) => `${Math.round(value)}%`)}</dd></div>
                </>
              )}
            </dl>
          </div>

          <section className="weather-forecast-hours" aria-labelledby="weather-hours-title">
            <h3 id="weather-hours-title">Hourly conditions</h3>
            {selectedHours.length > 0 ? (
              <div
                className="weather-hour-chart"
                role="list"
                aria-label={`Hourly forecast for ${fullDayLabel(selectedDay.date)}`}
              >
                {selectedHours.map((hour) => {
                  const temperature = hour.temperature_c;
                  const range = Math.max(maximumHourlyTemp - minimumHourlyTemp, 1);
                  const height = temperature === null
                    ? 52
                    : 62 + ((temperature - minimumHourlyTemp) / range) * 74;
                  const wind = hour.wind_kph === null || !Number.isFinite(hour.wind_kph)
                    ? "–"
                    : `${Math.round(hour.wind_kph)} km/h${
                        hour.wind_direction ? ` ${hour.wind_direction}` : ""
                      }`;

                  return (
                    <article
                      className="weather-hour-column"
                      key={`${hour.time_epoch}-${hour.time}`}
                      role="listitem"
                      aria-label={`${hourLabel(hour, timezone)}, ${hour.condition ?? "unknown conditions"}, wind ${wind}`}
                    >
                      <strong>{metric(temperature, (value) => `${Math.round(value)}°`)}</strong>
                      <div className="weather-hour-bar" style={{ height: `${height}px` }}>
                        {hour.icon_url && <img src={hour.icon_url} alt="" width="44" height="44" />}
                      </div>
                      <time dateTime={hour.time}>{hourLabel(hour, timezone)}</time>
                      <small>{metric(hour.rain_chance_percent, (value) => `${Math.round(value)}% rain`)}</small>
                      <small className="weather-hour-wind">Wind {wind}</small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="weather-forecast-empty">
                Hourly conditions are not available for this day.
              </p>
            )}
          </section>

          <nav className="weather-forecast-days" aria-label="Choose forecast day">
            {forecast.map((day, index) => (
              <button
                key={day.date}
                type="button"
                className={day.date === selectedDay.date ? "active" : ""}
                onClick={() => setSelectedDate(day.date)}
                aria-pressed={day.date === selectedDay.date}
              >
                <span>{shortDayLabel(day.date, index)}</span>
                <img src={day.icon_url} alt="" width="48" height="48" />
                <strong>{Math.round(day.max_temp_c)}°</strong>
                <small>{Math.round(day.min_temp_c)}°</small>
              </button>
            ))}
          </nav>
        </div>
      </section>
    </div>
  );
}