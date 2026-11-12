import type {
  WeatherForecastDay,
  WeatherForecastHour,
  WeatherResponse,
  WeatherVolleyball,
} from "../api";

/** `<select>` value that represents the live/current conditions. */
export const CURRENT_WEATHER_TIME = "current";

/** The label shown for the live conditions option. */
export const CURRENT_WEATHER_LABEL = "Current conditions";

/** Conditions rendered in the compact weather box for the chosen time. */
export interface WeatherConditions {
  /** Text describing the chosen moment, e.g. "Today (Now)". */
  label: string;
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
}

export interface WeatherTimeOption {
  value: string;
  label: string;
}

function timeZoneOption(timezone: string | null): { timeZone?: string } {
  return timezone ? { timeZone: timezone } : {};
}

/**
 * Formats a forecast epoch (seconds) as a short, timezone-aware label, e.g.
 * "Tue, 27 Oct · 3:00 PM". Returns an empty string for unusable epochs.
 */
export function formatForecastMoment(
  epochSeconds: number,
  timezone: string | null,
): string {
  if (!Number.isFinite(epochSeconds)) return "";

  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";

  const zone = timeZoneOption(timezone);
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...zone,
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...zone,
  }).format(date);

  return `${day} · ${time}`;
}

/** The `<select>` value for a forecast hour. */
export function forecastHourValue(hour: WeatherForecastHour): string {
  return String(hour.time_epoch);
}

/**
 * Resolves the chosen `<select>` value to an hourly forecast entry.
 *
 * Returns `null` for the live conditions option — and also when the selected
 * hour is no longer part of the (refreshed) forecast, so callers fall back to
 * current conditions instead of showing a stale selection.
 */
export function findSelectedHour(
  hourly: WeatherForecastHour[],
  value: string,
): WeatherForecastHour | null {
  if (!value || value === CURRENT_WEATHER_TIME) return null;

  const epoch = Number(value);
  if (!Number.isFinite(epoch)) return null;

  return hourly.find((hour) => hour.time_epoch === epoch) ?? null;
}

/** The options for the weather time dropdown: current conditions plus each hour. */
export function weatherTimeOptions(
  hourly: WeatherForecastHour[],
  timezone: string | null,
): WeatherTimeOption[] {
  const seen = new Set<number>();
  const hourOptions: WeatherTimeOption[] = [];

  hourly.forEach((hour) => {
    if (!Number.isFinite(hour.time_epoch) || seen.has(hour.time_epoch)) return;
    seen.add(hour.time_epoch);
    hourOptions.push({
      value: forecastHourValue(hour),
      label: formatForecastMoment(hour.time_epoch, timezone),
    });
  });

  return [
    { value: CURRENT_WEATHER_TIME, label: CURRENT_WEATHER_LABEL },
    ...hourOptions,
  ];
}

function firstDay(
  forecast: WeatherForecastDay[],
): WeatherForecastDay | undefined {
  return forecast[0];
}

/**
 * The conditions to display for the chosen time. `hour` is `null` for the
 * live conditions option.
 */
export function conditionsForTime(
  weather: WeatherResponse,
  hour: WeatherForecastHour | null,
): WeatherConditions | null {
  if (hour) {
    return {
      label: formatForecastMoment(
        hour.time_epoch,
        weather.location?.timezone ?? null,
      ),
      temperature_c: hour.temperature_c,
      feels_like_c: hour.feels_like_c,
      condition: hour.condition,
      icon_url: hour.icon_url,
      wind_kph: hour.wind_kph,
      wind_gust_kph: hour.wind_gust_kph,
      wind_direction: hour.wind_direction,
      humidity_percent: hour.humidity_percent ?? null,
      uv_index: hour.uv_index ?? null,
      precipitation_mm: hour.precipitation_mm ?? null,
      rain_chance_percent: hour.rain_chance_percent,
    };
  }

  const current = weather.current;
  if (!current) return null;

  const day = firstDay(Array.isArray(weather.forecast) ? weather.forecast : []);

  return {
    label: "Today (Now)",
    temperature_c: current.temperature_c,
    feels_like_c: current.feels_like_c,
    condition: current.condition,
    icon_url: current.icon_url,
    wind_kph: current.wind_kph,
    wind_gust_kph: current.wind_gust_kph,
    wind_direction: current.wind_direction,
    humidity_percent: current.humidity_percent,
    uv_index: current.uv_index,
    precipitation_mm: current.precipitation_mm,
    rain_chance_percent:
      current.rain_chance_percent ?? day?.rain_chance_percent ?? null,
  };
}

/**
 * The advisor assessment for the chosen time. The API computes one per hourly
 * entry; the live option uses the top-level assessment.
 */
export function advisorForTime(
  weather: WeatherResponse,
  hour: WeatherForecastHour | null,
): WeatherVolleyball | null {
  if (hour) return hour.volleyball ?? null;
  return weather.volleyball ?? null;
}

/**
 * The ISO timestamp to hand to the share endpoint for the chosen time.
 * `null` means "share the current conditions".
 */
export function shareTargetTime(hour: WeatherForecastHour | null): string | null {
  if (!hour || !Number.isFinite(hour.time_epoch)) return null;

  const date = new Date(hour.time_epoch * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}
