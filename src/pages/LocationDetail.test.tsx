import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Location } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import LocationDetail from "./LocationDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, location: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const mapUrl = "https://www.google.com/maps/search/?api=1&query=-33.903769,151.186456";
const location = (overrides: Partial<Location> = {}): Location => ({
  id: 12,
  name: "Sydney Park",
  slug: "sydney-park",
  location_type: "park",
  formatted_address: "Sydney Park Road, Alexandria NSW",
  locality: "Alexandria",
  administrative_area: "NSW",
  country_code: "AU",
  timezone: "Australia/Sydney",
  latitude: -33.903769,
  longitude: 151.186456,
  status: "active",
  verification_status: "verified",
  geocoding_status: "resolved",
  coordinate_source: "geoapify",
  map_url: mapUrl,
  ...overrides,
});

const auth: AuthContextValue = {
  user: { id: 1, name: "Admin", email_address: "admin@example.com", roles: ["admin"] },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
};

function renderPage() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/settings/locations/sydney-park"]}>
        <Routes>
          <Route path="/settings/locations/:slug" element={<LocationDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");
  mockedApi.location.mockResolvedValue(location());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LocationDetail", () => {
  it("loads the route slug and displays the embedded map and navigation link", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Sydney Park" })).toBeInTheDocument();
    expect(mockedApi.location).toHaveBeenCalledWith("sydney-park");
    expect(screen.getByTitle("Map of Sydney Park")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in google maps/i })).toHaveAttribute(
      "href",
      mapUrl,
    );
  });

  it("omits the map section when the location has no coordinates or map url", async () => {
    mockedApi.location.mockResolvedValue(
      location({ latitude: null, longitude: null, map_url: null }),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Sydney Park" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Map" })).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("preserves the not-found state when loading fails", async () => {
    mockedApi.location.mockRejectedValue(new Error("Location not found"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Location not found" })).toBeInTheDocument();
    expect(screen.getAllByText("Location not found")).toHaveLength(2);
  });
});