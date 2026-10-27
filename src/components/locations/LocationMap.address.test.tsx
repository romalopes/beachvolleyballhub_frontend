import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocationMap from "./LocationMap";

afterEach(() => vi.unstubAllEnvs());

describe("LocationMap address queries", () => {
  it("embeds and links to a textual address without coordinates", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");
    const query = "100 Ocean Drive, Miami Beach, FL 33139, USA";

    render(
      <LocationMap
        name="Alex Player"
        latitude={null}
        longitude={null}
        externalUrl={null}
        query={query}
      />,
    );

    const source = new URL(screen.getByTitle("Map of Alex Player").getAttribute("src") ?? "");
    expect(source.searchParams.get("q")).toBe(query);

    const link = new URL(
      screen.getByRole("link", { name: /open in google maps/i }).getAttribute("href") ?? "",
    );
    expect(link.origin + link.pathname).toBe("https://www.google.com/maps/search/");
    expect(link.searchParams.get("api")).toBe("1");
    expect(link.searchParams.get("query")).toBe(query);
  });

  it("still renders nothing when neither coordinates, query, nor external link is provided", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");

    const { container } = render(
      <LocationMap name="Unknown" latitude={null} longitude={null} externalUrl={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
