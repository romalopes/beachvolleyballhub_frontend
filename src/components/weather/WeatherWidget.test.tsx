import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      max_wind_direction: "NE",
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
      max_wind_direction: "SE",
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
      max_wind_direction: null,
    },
  ],
  hourly: (() => {
    const startEpoch = Math.floor(Date.parse("2026-10-27T00:00:00Z") / 1000);
    return Array.from({ length: 24 }, (_, index) => {
      const hourOfDay = (index % 8) * 3;
      const date = new Date((startEpoch + index * 3 * 60 * 60) * 1000);
      const dateStr = date.toISOString().slice(0, 10);
      return {
        time: `${dateStr} ${String(hourOfDay).padStart(2, "0")}:00`,
        time_epoch: startEpoch + index * 3 * 60 * 60,
        temperature_c: 20 + index,
        feels_like_c: 21 + index,
        condition: index % 3 === 0 ? "Partly cloudy" : "Sunny",
        icon_url: "https://cdn.weatherapi.com/hour.png",
        rain_chance_percent: 20 + index,
        wind_kph: 18 + index,
        wind_gust_kph: 27 + index,
        wind_direction: index === 0 ? "NE" : "E",
      };
    });
  })(),
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
  location: {
    latitude: -33.9,
    longitude: 151.2,
    timezone: "Australia/Sydney",
  },
  updated_at: "2026-10-27T05:00:00Z",
  stale: false,
  volleyball: {
    score: 78,
    label: "Good",
    advice: ["UV is elevated: use sunscreen, a hat and sunglasses."],
    warnings: [],
    safety_override: false,
  },
  attribution: {
    name: "WeatherAPI.com",
    url: "https://www.weatherapi.com/",
  },
  ...overrides,
});

describe("WeatherWidget", () => {
  it("renders a compact current-weather box and selectable forecast days", () => {
    const { container } = render(
      <WeatherWidget
        weather={weather()}
        loading={false}
        error={null}
        locationName="Adelaide, SA"
      />,
    );
    const weatherBox = container.querySelector<HTMLElement>(".weather-box");

    expect(weatherBox).not.toBeNull();
    expect(within(weatherBox!).getByText("Today (Now)")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("23°")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("Partly cloudy")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("In Adelaide, SA")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("18 km/h NE")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("27 km/h")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("64%")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("6.0")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("0.0 mm")).toBeInTheDocument();
    expect(
      within(weatherBox!).getByRole("list", { name: "Daily forecast" }),
    ).toBeInTheDocument();
    expect(within(weatherBox!).getAllByRole("listitem")).toHaveLength(3);
    expect(within(weatherBox!).getByText("24 km/h NE")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("31 km/h SE")).toBeInTheDocument();
    expect(within(weatherBox!).getByText("18 km/h")).toBeInTheDocument();
    expect(
      within(weatherBox!).getByRole("button", { name: "View forecast" }),
    ).toBeInTheDocument();
  });

  it("renders the suitability rating with coaching advice", () => {
    render(
      <WeatherWidget
        weather={weather()}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("78/100 for beach volleyball")).toBeInTheDocument();
    expect(screen.getByText(/Playing-suitability estimate/)).toBeInTheDocument();
    expect(screen.getByText(/UV is elevated/)).toBeInTheDocument();
  });

  it("opens a detailed forecast with current metrics and timezone-grouped hours", async () => {
    const user = userEvent.setup();
    render(
      <WeatherWidget
        weather={weather()}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    await user.click(screen.getByRole("button", { name: "View forecast" }));

    const dialog = screen.getByRole("dialog", {
      name: "Coogee Beach, Sydney",
    });
    expect(within(dialog).getByText(/Tuesday.*27.*October|Tuesday.*October.*27/)).toBeInTheDocument();
    expect(within(dialog).getByText("24°C")).toBeInTheDocument();
    expect(within(dialog).getByText("64%")).toBeInTheDocument();

    const hourly = within(dialog).getByRole("list", {
      name: /Hourly forecast for Tuesday.*27.*October|Hourly forecast for Tuesday.*October.*27/,
    });
    expect(hourly).toHaveTextContent("20% rain");
    expect(hourly).toHaveTextContent("Wind 18 km/h NE");
    expect(hourly).toHaveTextContent("Wind 19 km/h E");
    expect(hourly.querySelectorAll(".weather-hour-column").length).toBeGreaterThan(0);
    expect(document.body).toHaveStyle({ overflow: "hidden" });
  });

  it("opens the selected day and switches between modal forecast days", async () => {
    const user = userEvent.setup();
    render(
      <WeatherWidget
        weather={weather()}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /View Wed forecast, Partly cloudy/i,
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Wednesday.*28.*October|Wednesday.*October.*28/)).toBeInTheDocument();
    expect(within(dialog).getByText("31 km/h SE")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^Thu19°13°$/ }));
    expect(within(dialog).getByText(/Thursday.*29.*October|Thursday.*October.*29/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("list", { name: /Hourly forecast for Thursday.*29.*October|Hourly forecast for Thursday.*October.*29/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(
        "Hourly conditions are not available for this day.",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("listitem").length,
    ).toBeGreaterThan(0);
  });

  it("closes the forecast with Escape and restores body scrolling", async () => {
    const user = userEvent.setup();
    render(
      <WeatherWidget
        weather={weather()}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    await user.click(screen.getByRole("button", { name: "View forecast" }));
    expect(
      screen.getByRole("button", { name: "Close weather forecast" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
  });

  it("handles malformed runtime forecast arrays without rendering controls", () => {
    render(
      <WeatherWidget
        weather={weather({
          forecast: null as unknown as WeatherResponse["forecast"],
        })}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(screen.getByText("23°")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Daily forecast" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View forecast" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces safety warnings with alert semantics", () => {
    render(
      <WeatherWidget
        weather={weather({
          volleyball: {
            score: 42,
            label: "Poor",
            advice: [],
            warnings: ["Dangerous gusts: postpone play and secure equipment."],
            safety_override: true,
          },
        })}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dangerous gusts: postpone play and secure equipment.",
    );
  });

  it("shows provider attribution and the official warnings link", () => {
    render(
      <WeatherWidget
        weather={weather()}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(screen.getByText("WeatherAPI.com")).toBeInTheDocument();
    expect(screen.getByText("Bureau of Meteorology")).toBeInTheDocument();
  });

  it("handles loading, error and finding-location states", () => {
    const { rerender } = render(
      <WeatherWidget
        weather={null}
        loading
        error="boom"
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading weather…");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Weather is temporarily unavailable. boom",
    );

    rerender(
      <WeatherWidget
        weather={null}
        loading={false}
        error={null}
        findingLocation
        locationName="Adelaide, SA"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Finding that location…",
    );
  });

  it("does not crash when a runtime response is missing weather data", () => {
    render(
      <WeatherWidget
        weather={[] as unknown as WeatherResponse}
        loading={false}
        error={null}
        locationName="Coogee Beach, Sydney"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Beach volleyball weather" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View forecast" }),
    ).not.toBeInTheDocument();
  });
});