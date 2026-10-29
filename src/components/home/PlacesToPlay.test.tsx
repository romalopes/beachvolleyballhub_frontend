import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type NearbyOrganisation } from "../../api";
import PlacesToPlay from "./PlacesToPlay";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: { ...actual.api, nearbyOrganisations: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);

const organisation = (
  overrides: Partial<NearbyOrganisation> = {},
): NearbyOrganisation => ({
  id: 7,
  name: "A Very Long Beach Volleyball Organisation Name That Still Wraps",
  slug: "coogee-club",
  acronym: null,
  organisation_type: "club",
  logo_url: null,
  distance_km: 2.4,
  default_location: {
    id: 11,
    name: "Coogee Beach",
    slug: "coogee-beach",
    location_type: "beach",
    formatted_address: null,
    locality: "Coogee",
    administrative_area: "NSW",
    country_code: "AU",
    latitude: -33.92,
    longitude: 151.26,
    map_url: null,
  },
  ...overrides,
});

function renderComponent() {
  return render(
    <MemoryRouter>
      <PlacesToPlay latitude={-33.92} longitude={151.26} />
    </MemoryRouter>,
  );
}

describe("PlacesToPlay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading then organisation cards with fallbacks and links", async () => {
    let resolveRequest!: (value: { organisations: NearbyOrganisation[] }) => void;
    mockedApi.nearbyOrganisations.mockReturnValue(
      new Promise((resolve) => { resolveRequest = resolve; }),
    );

    renderComponent();
    expect(screen.getByRole("status")).toHaveTextContent("Finding beach volleyball");

    resolveRequest({ organisations: [organisation()] });

    expect(await screen.findByText(/A Very Long Beach Volleyball/)).toBeInTheDocument();
    expect(screen.getByText("A")).toHaveClass("places-to-play-logo-fallback");
    expect(screen.getByText("Coogee, NSW, AU")).toBeInTheDocument();
    expect(screen.getByText("2.4 km away")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View organisation/ })).toHaveAttribute(
      "href",
      "/organisations/coogee-club",
    );
  });

  it("renders empty results", async () => {
    mockedApi.nearbyOrganisations.mockResolvedValue({ organisations: [] });
    renderComponent();
    expect(await screen.findByText(/No organisations with a verified venue/)).toBeInTheDocument();
  });

  it("renders errors and retries", async () => {
    const user = userEvent.setup();
    mockedApi.nearbyOrganisations
      .mockRejectedValueOnce(new Error("Nearby service unavailable"))
      .mockResolvedValueOnce({ organisations: [organisation({ name: "Retry Club" })] });

    renderComponent();
    expect(await screen.findByRole("alert")).toHaveTextContent("Nearby service unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Retry Club")).toBeInTheDocument();
    expect(mockedApi.nearbyOrganisations).toHaveBeenCalledTimes(2);
  });

  it("refetches for new coordinates and aborts the stale request", async () => {
    mockedApi.nearbyOrganisations.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(
      <MemoryRouter>
        <PlacesToPlay latitude={-33.92} longitude={151.26} />
      </MemoryRouter>,
    );
    const firstSignal = mockedApi.nearbyOrganisations.mock.calls[0][1];

    rerender(
      <MemoryRouter>
        <PlacesToPlay latitude={-33.87} longitude={151.21} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedApi.nearbyOrganisations).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);
    expect(mockedApi.nearbyOrganisations).toHaveBeenLastCalledWith(
      { latitude: -33.87, longitude: 151.21, radius_km: 25, limit: 6 },
      expect.any(AbortSignal),
    );
  });
});