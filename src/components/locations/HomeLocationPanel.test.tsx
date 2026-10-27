import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeLocationPanel from "./HomeLocationPanel";

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof HomeLocationPanel>> = {}) {
  const props: React.ComponentProps<typeof HomeLocationPanel> = {
    heading: "Near You",
    searchValue: "",
    onSearchValueChange: vi.fn(),
    onSearch: vi.fn((event) => event.preventDefault()),
    showUseMyLocation: false,
    onUseMyLocation: vi.fn(),
    loading: false,
    error: null,
    description: "Your current location (-33.9000, 151.2000).",
    mapName: "Your location",
    mapLatitude: -33.9,
    mapLongitude: 151.2,
    mapQuery: "-33.9,151.2",
    ...overrides,
  };

  return { ...render(<HomeLocationPanel {...props} />), props };
}

describe("HomeLocationPanel", () => {
  it("renders the location controls, description and map", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");
    renderPanel();

    expect(screen.getByRole("heading", { name: "Near You" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search for a location" })).toBeInTheDocument();
    expect(screen.getByText("Your current location (-33.9000, 151.2000).")).toBeInTheDocument();
    expect(screen.getByTitle("Map of Your location")).toBeInTheDocument();
  });

  it("forwards search input, submit and restore-location actions", async () => {
    const user = userEvent.setup();
    const onSearchValueChange = vi.fn();
    const onSearch = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onUseMyLocation = vi.fn();
    renderPanel({
      showUseMyLocation: true,
      onSearchValueChange,
      onSearch,
      onUseMyLocation,
    });

    await user.type(screen.getByRole("searchbox"), "Bondi");
    expect(onSearchValueChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearch).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(onUseMyLocation).toHaveBeenCalledOnce();
  });

  it("renders location progress and errors accessibly", () => {
    renderPanel({ loading: true, error: "Location permission was denied." });

    expect(screen.getByText("Detecting your location…")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Location permission was denied. Showing featured venue.",
    );
  });
});