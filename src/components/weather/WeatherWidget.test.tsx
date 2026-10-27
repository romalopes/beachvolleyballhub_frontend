import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WeatherResponse } from "../../api";
import WeatherWidget from "./WeatherWidget";

const weather = (overrides: Partial<WeatherResponse> = {}): WeatherResponse => ({
  forecast: [
    {
      date: "2026-10-27",
      max_temp_c: 26,
      min_temp_c: 16,
      average_temp_c: 21,
      condition: "Sunny",
      icon_url: "https://cdn.weatherapi.com/icon.png",
      rain_chance_percent: 20,
      max_wind_kph: 24,
    },
    {
      date: "2026-10-28",
      max_temp_c: 22,
      min_temp_c: 14,
      average_temp_c: 18,
      condition: "Partly cloudy",
      icon_url: "https://cdn.weatherapi.com/icon2.png",
      rain_chance_percent: 55,
      max_wind_kph: 31,
    },
    {
      date: "2026-10-29",
      max_temp_c: 19,
      min_temp_c: 13,
      average_temp_c: 16,
      condition: "Light rain",
      icon_url: "https://cdn.weatherapi.com/icon3.png",
      rain_chance_percent: 85,
      max_wind_kph: 18,
    },
  ],
  current: {
    temperature_c: 23.0,
    feels_like_c: 24.0,
    condition: "Partly cloudy",
    condition_code: 1003,
    wind_kph: 18,
    wind_gust_kph: 27,
    wind_degree: 45,
    wind_direction: "NE",
    humidity_percent: 64,
    uv_index: 6.0,
    precipitation_mm: 0.0,
    icon_url: "https://cdn.weatherapi.com/current.png",
  },
  location: { latitude: -33.9, longitude: 151.2, timezone: "Australia/Sydney" },
  updated_at: "2026-10-27T05:00:00Z",
  stale: false,
  volleyball: {
    score: 78,
    label: "Good",
    advice: ["UV is elevated: use sunscreen, a hat and sunglasses."],
    warnings: [],
    safety_override: false,
  },
  attribution: { name: "WeatherAPI.com", url: "https://www.weatherapi.com/" },
  ...overrides,
});

describe("WeatherWidget", () => {
  it("renders current conditions with written wind, rain and temperature detail", () => {
    render(<WeatherWidget weather={weather()} loading={false} error={null} locationName="Adelaide, SA" />);

    expect(screen.getByText("23°C")).toBeInTheDocument();
    expect(screen.getByText("Feels like 24°C")).toBeInTheDocument();
    expect(screen.getByText(/18 km\/h NE/)).toBeInTheDocument();
    expect(screen.getByText("27 km/h")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("6.0")).toBeInTheDocument();
    expect(screen.getByText("0.0 mm")).toBeInTheDocument();
    expect(screen.getByText("Adelaide, SA")).toBeInTheDocument();
  });

  it("renders the suitability rating with coaching advice", () => {
    render(<WeatherWidget weather={weather()} loading={false} error={null} locationName="Coogee Beach, Sydney" />);

    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("78/100 for beach volleyball")).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent(
      "UV is elevated: use sunscreen, a hat and sunglasses.",
    );
    expect(screen.getByText(/not an official safety rating/i)).toBeInTheDocument();
  });

  it("shows forecast days with rain chance and max wind", () => {
    render(<WeatherWidget weather={weather()} loading={false} error={null} locationName="Coogee Beach, Sydney" />);

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText(/Rain 85%/)).toBeInTheDocument();
    expect(screen.getByText(/Wind 31 km\/h/)).toBeInTheDocument();
  });

  it("surfaces safety warnings with alert semantics", () => {
    const stormy = weather({
      volleyball: {
        score: 42,
        label: "Poor",
        advice: [],
        warnings: ["Dangerous gusts: postpone play and secure equipment."],
        safety_override: true,
      },
    });

    render(<WeatherWidget weather={stormy} loading={false} error={null} locationName="Coogee Beach, Sydney" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dangerous gusts: postpone play and secure equipment.",
    );
  });

  it("shows the provider attribution and BOM warnings link", () => {
    render(<WeatherWidget weather={weather()} loading={false} error={null} locationName="Coogee Beach, Sydney" />);

    expect(screen.getByText("WeatherAPI.com")).toBeInTheDocument();
    expect(screen.getByText("Bureau of Meteorology")).toBeInTheDocument();
  });

  it("handles loading and error states without data", () => {
    render(<WeatherWidget weather={null} loading error="boom" locationName="Coogee Beach, Sydney" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading weather…");
    expect(screen.getByRole("alert")).toHaveTextContent("Weather is temporarily unavailable. boom");
  });

  it("shows a finding-location status while a search is being resolved", () => {
    render(
      <WeatherWidget weather={null} loading={false} error={null} findingLocation locationName="adelaide, SA" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Finding that location…");
  });

  it("does not crash when a runtime response is missing forecast data", () => {
    const incompleteWeather = [] as unknown as WeatherResponse;

    render(
      <WeatherWidget
        weather={incompleteWeather}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(screen.getByRole("heading", { name: "Beach volleyball weather" })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});