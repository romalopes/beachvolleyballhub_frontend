import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
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
    },
  };
});

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");
  mockedApi.categories.mockResolvedValue([]);
  mockedApi.skills.mockResolvedValue([]);
  mockedApi.drills.mockResolvedValue([]);

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

afterEach(() => {
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