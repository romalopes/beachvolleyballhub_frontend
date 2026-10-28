import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Tournament, type TrainingSession, type WeatherResponse } from "../api";
import Home from "./Home";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      categories: vi.fn(),
      skills: vi.fn(),
      drills: vi.fn(),
      trainingSessions: vi.fn(),
      tournaments: vi.fn(),
      weather: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

function futureIso(daysFromNow: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 28, 12));
  vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");
  mockedApi.categories.mockResolvedValue([]);
  mockedApi.skills.mockResolvedValue([]);
  mockedApi.drills.mockResolvedValue([]);
  mockedApi.trainingSessions.mockResolvedValue([]);
  mockedApi.tournaments.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 100, total: 0, total_pages: 0 },
  });
  mockedApi.weather.mockResolvedValue({
    forecast: [],
    hourly: [],
    current: null,
    location: { latitude: -33.9, longitude: 151.2, timezone: "Australia/Sydney" },
    updated_at: "2026-10-28T00:00:00Z",
    stale: false,
    volleyball: null,
    attribution: { name: "WeatherAPI.com", url: "https://www.weatherapi.com/" },
  });

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: -33.9,
            longitude: 151.2,
          },
        } as GeolocationPosition);
      }),
    },
  });
});

const training = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 1,
  title: "Sunrise training",
  description: null,
  starts_at: futureIso(7, 8),
  ends_at: futureIso(7, 9),
  location: "Coogee Beach",
  status: "scheduled",
  visibility: "shared",
  created_by_id: 1,
  ...overrides,
});

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 2,
  name: "Future Sand Series",
  organisation: { id: 1, name: "Beach Club", acronym: "BC" } as Tournament["organisation"],
  scope: "club",
  division_scheme: "letter",
  publication_state: "active",
  website_url: null,
  description: null,
  location_name: "Maroubra Beach",
  timezone: "UTC",
  all_day: false,
  starts_at: futureIso(7, 6),
  ends_at: futureIso(7, 10),
  created_by_account_id: 1,
  divisions: [],
  participations: [],
  watch_links: [],
  ...overrides,
});

function weatherWithHourly(): WeatherResponse {
  return {
    forecast: [],
    hourly: [
      {
        time: "2099-11-02 06:00",
        time_epoch: Date.parse("2099-11-02T06:00:00Z") / 1000,
        temperature_c: 24,
        feels_like_c: 25,
        condition: "Sunny",
        icon_url: null,
        rain_chance_percent: 5,
        wind_kph: 12,
        wind_gust_kph: 18,
        wind_direction: "NE",
      },
    ],
    current: null,
    location: { latitude: -33.9, longitude: 151.2, timezone: "UTC" },
    updated_at: "2099-11-02T05:00:00Z",
    stale: false,
    volleyball: null,
    attribution: { name: "WeatherAPI.com", url: "https://www.weatherapi.com/" },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home location search", () => {
  it("updates the map and external link when a textual location is submitted", async () => {
    const user = userEvent.setup();
    renderHome();

    const input = await screen.findByRole("searchbox", { name: "Search for a location" });
    await waitFor(() => expect(screen.getByTitle("Map of Your location")).toBeInTheDocument());

    await user.type(input, "  Miami Beach, Florida  {Enter}");

    expect(screen.getByRole("heading", { name: "Location Search" })).toBeInTheDocument();
    expect(screen.getByText("Showing Google Maps results for Miami Beach, Florida.")).toBeInTheDocument();

    const source = new URL(
      screen.getByTitle("Map of Miami Beach, Florida").getAttribute("src") ?? "",
    );
    expect(source.searchParams.get("q")).toBe("Miami Beach, Florida");

    const link = new URL(
      screen.getByRole("link", { name: /open in google maps/i }).getAttribute("href") ?? "",
    );
    expect(link.searchParams.get("query")).toBe("Miami Beach, Florida");
  });

  it("ignores an empty search and can restore the detected location", async () => {
    const user = userEvent.setup();
    renderHome();

    const input = await screen.findByRole("searchbox", { name: "Search for a location" });
    await waitFor(() => expect(screen.getByTitle("Map of Your location")).toBeInTheDocument());

    await user.type(input, "   {Enter}");
    expect(screen.getByRole("heading", { name: "Near You" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use my location" })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "Bondi Beach{Enter}");
    expect(screen.getByTitle("Map of Bondi Beach")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use my location" }));

    expect(screen.getByRole("heading", { name: "Near You" })).toBeInTheDocument();
    expect(screen.getByTitle("Map of Your location")).toBeInTheDocument();
    expect(input).toHaveValue("");

    const source = new URL(screen.getByTitle("Map of Your location").getAttribute("src") ?? "");
    expect(source.searchParams.get("q")).toBe("-33.9,151.2");
  });
});

describe("Home upcoming agenda and weather layout", () => {
  it("loads visible month events and renders the hourly forecast once", async () => {
    mockedApi.trainingSessions.mockResolvedValue([training()]);
    mockedApi.tournaments.mockResolvedValueOnce({
      data: [tournament()],
      meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
    });
    mockedApi.weather.mockResolvedValue(weatherWithHourly());

    renderHome();

    expect(await screen.findByText("Future Sand Series")).toBeInTheDocument();
    expect(screen.getByText("Sunrise training")).toBeInTheDocument();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "scheduled",
        starts_at_from: "2026-09-27",
        starts_at_to: "2026-11-08",
      }),
    );
    expect(mockedApi.tournaments).toHaveBeenCalledWith(
      expect.objectContaining({
        publication_state: "active",
        page: 1,
        per_page: 100,
        starts_at: "2026-09-27",
        ends_at: "2026-11-08",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findAllByRole("heading", { name: "Next 24 hours" }),
    ).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Beach volleyball weather" })).toBeInTheDocument();
  });

  it("refetches the visible range for month and week navigation", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderHome();

    await waitFor(() => expect(mockedApi.trainingSessions).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Next period" }));
    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          starts_at_from: "2026-11-01",
          starts_at_to: "2026-12-06",
        }),
      ),
    );

    await user.click(screen.getByRole("tab", { name: "Week" }));
    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          starts_at_from: "2026-11-01",
          starts_at_to: "2026-11-08",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Previous period" }));
    await waitFor(() =>
      expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          starts_at: "2026-10-25",
          ends_at: "2026-11-01",
          publication_state: "active",
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Next period" }));
    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          starts_at_from: "2026-11-01",
          starts_at_to: "2026-11-08",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          starts_at_from: "2026-10-25",
          starts_at_to: "2026-11-01",
        }),
      ),
    );
  });

  it("loads every tournament page", async () => {
    mockedApi.tournaments
      .mockResolvedValueOnce({
        data: [tournament()],
        meta: { page: 1, per_page: 100, total: 2, total_pages: 2 },
      })
      .mockResolvedValueOnce({
        data: [tournament({ id: 3, name: "Second Sand Series" })],
        meta: { page: 2, per_page: 100, total: 2, total_pages: 2 },
      });

    renderHome();

    expect(await screen.findByText("Second Sand Series")).toBeInTheDocument();
    expect(mockedApi.tournaments).toHaveBeenCalledTimes(2);
    expect(mockedApi.tournaments).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, per_page: 100 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows agenda empty and failure states", async () => {
    const { unmount } = renderHome();
    expect(
      await screen.findByText(/No training sessions or tournaments are scheduled/),
    ).toBeInTheDocument();
    unmount();

    mockedApi.trainingSessions.mockRejectedValueOnce(new Error("agenda failed"));
    renderHome();
    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent(
      "agenda failed",
    );
  });
});
