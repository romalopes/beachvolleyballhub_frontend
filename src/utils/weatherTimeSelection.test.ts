import { describe, expect, it } from "vitest";
import type {
  WeatherForecastDay,
  WeatherForecastHour,
  WeatherResponse,
} from "../api";
import {
  CURRENT_WEATHER_LABEL,
  CURRENT_WEATHER_TIME,
  advisorForTime,
  conditionsForTime,
  findSelectedHour,
  forecastHourValue,
  formatForecastMoment,
  shareTargetTime,
  weatherTimeOptions,
} from "./weatherTimeSelection";

const TIMEZONE = "Australia/Sydney";

function hour(
  epoch: number,
  overrides: Partial<WeatherForecastHour> = {},
): WeatherForecastHour {
  return {
    time: "2026-10-27 18:00",
    time_epoch: epoch,
    temperature_c: 29,
    feels_like_c: 31,
    condition: "Sunny",
    icon_url: "https://cdn.weatherapi.com/hour.png",
    rain_chance_percent: 70,
    wind_kph: 32,
    wind_gust_kph: 45,
    wind_direction: "SE",
    humidity_percent: 71,
    uv_index: 9,
    precipitation_mm: 0.4,
    volleyball: {
      score: 48,
      label: "Poor",
      advice: ["Challenging wind: practise wind-adjusted serving."],
      warnings: [],
      safety_override: false,
    },
    ...overrides,
  };
}

const day: WeatherForecastDay = {
  date: "2026-10-27",
  max_temp_c: 26,
  min_temp_c: 16,
  average_temp_c: 21,
  condition: "Sunny",
  icon_url: "https://cdn.weatherapi.com/icon.png",
  rain_chance_percent: 20,
  max_wind_kph: 24,
  max_wind_direction: "NE",
};

function weather(overrides: Partial<WeatherResponse> = {}): WeatherResponse {
  return {
    forecast: [day],
    hourly: [
      hour(1_793_107_200),
      hour(1_793_118_000, {
        time: "2026-10-27 21:00",
        temperature_c: 24,
        condition: "Partly cloudy",
        volleyball: {
          score: 72,
          label: "Good",
          advice: [],
          warnings: ["Heavy rain expected"],
          safety_override: true,
        },
      }),
    ],
    current: {
      temperature_c: 23,
      feels_like_c: 24,
      condition: "Partly cloudy",
      condition_code: 1003,
      wind_kph: 18,
      wind_gust_kph: 27,
      wind_degree: 45,
      wind_direction: "NE",
      humidity_percent: 64,
      uv_index: 6,
      precipitation_mm: 0,
      icon_url: "https://cdn.weatherapi.com/current.png",
    },
    location: { latitude: -33.9, longitude: 151.2, timezone: TIMEZONE },
    updated_at: "2026-10-27T05:00:00Z",
    stale: false,
    volleyball: {
      score: 78,
      label: "Good",
      advice: ["UV is elevated."],
      warnings: [],
      safety_override: false,
    },
    attribution: { name: "WeatherAPI.com", url: "https://www.weatherapi.com/" },
    ...overrides,
  };
}

describe("weatherTimeSelection", () => {
  it("lists current conditions first and one option per forecast hour", () => {
    const data = weather();
    const options = weatherTimeOptions(data.hourly, TIMEZONE);

    expect(options).toHaveLength(data.hourly.length + 1);
    expect(options[0]).toEqual({
      value: CURRENT_WEATHER_TIME,
      label: CURRENT_WEATHER_LABEL,
    });
    expect(options[1]).toEqual({
      value: forecastHourValue(data.hourly[0]),
      label: formatForecastMoment(data.hourly[0].time_epoch, TIMEZONE),
    });
  });

  it("ignores duplicate and unusable epochs", () => {
    const options = weatherTimeOptions(
      [hour(Number.NaN), hour(1_793_107_200), hour(1_793_107_200)],
      TIMEZONE,
    );

    expect(options).toHaveLength(2);
    expect(options[1].value).toBe("1793107200");
  });

  it("formats a moment in the location timezone", () => {
    const epoch = 1_793_107_200;

    expect(formatForecastMoment(epoch, TIMEZONE)).not.toBe(
      formatForecastMoment(epoch, "UTC"),
    );
    expect(formatForecastMoment(epoch, TIMEZONE)).toMatch(/\d{1,2}:\d{2}/);
    expect(formatForecastMoment(Number.NaN, TIMEZONE)).toBe("");
  });

  it("resolves the selected dropdown value to a forecast hour", () => {
    const data = weather();

    expect(findSelectedHour(data.hourly, CURRENT_WEATHER_TIME)).toBeNull();
    expect(findSelectedHour(data.hourly, "")).toBeNull();
    expect(findSelectedHour(data.hourly, "not-a-number")).toBeNull();
    expect(findSelectedHour(data.hourly, "123456")).toBeNull();
    expect(findSelectedHour(data.hourly, "1793107200")).toBe(data.hourly[0]);
  });

  it("builds the display conditions for the current option", () => {
    const data = weather();
    const conditions = conditionsForTime(data, null);

    expect(conditions).toMatchObject({
      label: "Today (Now)",
      temperature_c: 23,
      condition: "Partly cloudy",
      humidity_percent: 64,
      uv_index: 6,
      precipitation_mm: 0,
      rain_chance_percent: day.rain_chance_percent,
    });
  });

  it("builds the display conditions for a selected hour", () => {
    const data = weather();
    const selected = data.hourly[0];

    expect(conditionsForTime(data, selected)).toMatchObject({
      label: formatForecastMoment(selected.time_epoch, TIMEZONE),
      temperature_c: 29,
      feels_like_c: 31,
      condition: "Sunny",
      wind_kph: 32,
      wind_gust_kph: 45,
      wind_direction: "SE",
      humidity_percent: 71,
      uv_index: 9,
      precipitation_mm: 0.4,
      rain_chance_percent: 70,
    });
  });

  it("returns no conditions when current weather is unavailable", () => {
    expect(conditionsForTime(weather({ current: null }), null)).toBeNull();
  });

  it("uses the per-hour advisor when a time is selected", () => {
    const data = weather();

    expect(advisorForTime(data, null)).toBe(data.volleyball);
    expect(advisorForTime(data, data.hourly[0])).toBe(
      data.hourly[0].volleyball,
    );
    expect(advisorForTime(data, hour(1, { volleyball: undefined }))).toBeNull();
  });

  it("targets the share link at the selected hour, or current when none is chosen", () => {
    const data = weather();

    expect(shareTargetTime(null)).toBeNull();
    expect(shareTargetTime(data.hourly[0])).toBe(
      new Date(data.hourly[0].time_epoch * 1000).toISOString(),
    );
    expect(shareTargetTime(hour(Number.NaN))).toBeNull();
  });
});

