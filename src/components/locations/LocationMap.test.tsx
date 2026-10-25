import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocationMap from "./LocationMap";

const externalUrl = "https://www.google.com/maps/search/?api=1&query=-33.903769,151.186456";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LocationMap", () => {
  it("embeds valid coordinates and retains the external navigation link", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");

    render(
      <LocationMap
        name="Sydney Park"
        latitude="-33.903769"
        longitude={151.186456}
        externalUrl={externalUrl}
      />,
    );

    const iframe = screen.getByTitle("Map of Sydney Park");
    const source = new URL(iframe.getAttribute("src") ?? "");
    expect(source.origin + source.pathname).toBe("https://www.google.com/maps/embed/v1/place");
    expect(source.searchParams.get("key")).toBe("embed-key");
    expect(source.searchParams.get("q")).toBe("-33.903769,151.186456");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");

    const link = screen.getByRole("link", { name: /open in google maps/i });
    expect(link).toHaveAttribute("href", externalUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the external-link fallback when the embed key is missing", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "");

    render(
      <LocationMap
        name="Sydney Park"
        latitude={-33.903769}
        longitude={151.186456}
        externalUrl={externalUrl}
      />,
    );

    expect(screen.queryByTitle("Map of Sydney Park")).not.toBeInTheDocument();
    expect(screen.getByText("Map preview is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in google maps/i })).toHaveAttribute(
      "href",
      externalUrl,
    );
  });

  it("shows a fallback for valid coordinates when neither a key nor map url is configured", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "");

    render(
      <LocationMap
        name="Sydney Park"
        latitude={-33.903769}
        longitude={151.186456}
        externalUrl={null}
      />,
    );

    expect(screen.getByText("Map preview is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open in google maps/i })).not.toBeInTheDocument();
  });

  it.each([
    [null, 151.186456],
    [-33.903769, null],
    ["not-a-number", 151.186456],
    [91, 151.186456],
    [-33.903769, -181],
  ])("does not embed invalid coordinates (%s, %s)", (latitude, longitude) => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");

    render(
      <LocationMap
        name="Sydney Park"
        latitude={latitude}
        longitude={longitude}
        externalUrl={externalUrl}
      />,
    );

    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link", { name: /open in google maps/i })).toBeInTheDocument();
  });

  it("renders nothing when neither an embed nor an external link is available", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");

    const { container } = render(
      <LocationMap name="Unknown" latitude={null} longitude={null} externalUrl={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});