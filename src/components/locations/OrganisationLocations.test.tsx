import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type Location,
  type Organisation,
  type OrganisationLocation,
} from "../../api";
import { paginated } from "../../test/paginated";
import OrganisationLocations from "./OrganisationLocations";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      organisationLocations: vi.fn(),
      createOrganisationLocation: vi.fn(),
      destroyOrganisationLocation: vi.fn(),
      updateOrganisation: vi.fn(),
      locations: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const venue = (overrides: Partial<Location> = {}): Location => ({
  id: 5,
  name: "Coogee Beach",
  location_type: "beach",
  formatted_address: "Coogee Beach, Sydney NSW",
  locality: "Sydney",
  administrative_area: "NSW",
  country_code: "AU",
  timezone: "Australia/Sydney",
  latitude: -33.9167,
  longitude: 151.25,
  status: "active",
  verification_status: "verified",
  geocoding_status: "resolved",
  coordinate_source: "geoapify",
  map_url: null,
  ...overrides,
});

const attached = (
  overrides: Partial<OrganisationLocation> = {},
): OrganisationLocation => ({
  ...venue(),
  association_id: 90,
  notes: null,
  default: false,
  ...overrides,
});

const organisation = (overrides: Partial<Organisation> = {}): Organisation =>
  ({
    id: 1,
    name: "Northern Club",
    can_edit: true,
    ...overrides,
  }) as Organisation;

describe("OrganisationLocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.organisationLocations.mockResolvedValue({ locations: [] });
    mockedApi.locations.mockResolvedValue(paginated([]));
    mockedApi.createOrganisationLocation.mockResolvedValue({
      organisation_location: attached({ default: true }),
    });
    mockedApi.destroyOrganisationLocation.mockResolvedValue(undefined);
    mockedApi.updateOrganisation.mockResolvedValue(organisation());
  });

it("lists the venues attached to the organisation", async () => {
    mockedApi.organisationLocations.mockResolvedValue({
      locations: [
        attached(),
        attached({ id: 6, name: "Bondi Beach", association_id: 91 }),
      ],
    });

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByText("Coogee Beach")).toBeInTheDocument();
    expect(screen.getByText("Bondi Beach")).toBeInTheDocument();
  });

  it("marks the default venue", async () => {
    mockedApi.organisationLocations.mockResolvedValue({
      locations: [attached({ default: true })],
    });

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByText("Default venue")).toBeInTheDocument();
  });

  it("attaches a verified venue", async () => {
    mockedApi.locations.mockResolvedValue(paginated([venue()]));

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Attach" }));

    await waitFor(() =>
      expect(mockedApi.createOrganisationLocation).toHaveBeenCalledWith(1, 5),
    );
  });

  it("offers only verified, active venues as candidates", async () => {
    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(mockedApi.locations).toHaveBeenCalledWith(
        expect.objectContaining({
          verification_status: "verified",
          status: "active",
        }),
      ),
    );
  });

  it("sets the default venue through the organisation update", async () => {
    mockedApi.organisationLocations.mockResolvedValue({
      locations: [attached()],
    });
    const onOrganisationUpdated = vi.fn();

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={onOrganisationUpdated}
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /set as default/i }),
    );

    await waitFor(() =>
      expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(1, {
        default_location_id: 5,
      }),
    );
    expect(onOrganisationUpdated).toHaveBeenCalled();
  });

  it("detaches a venue by its association id, not its location id", async () => {
    mockedApi.organisationLocations.mockResolvedValue({
      locations: [attached({ association_id: 90, id: 5 })],
    });

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(mockedApi.destroyOrganisationLocation).toHaveBeenCalledWith(1, 90),
    );
  });

  it("refuses to detach the default venue", async () => {
    mockedApi.organisationLocations.mockResolvedValue({
      locations: [attached({ default: true })],
    });

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    const remove = await screen.findByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
  });

  it("hides the write controls from users who cannot edit the organisation", async () => {
    mockedApi.organisationLocations.mockResolvedValue({
      locations: [attached()],
    });

    render(
      <OrganisationLocations
        organisation={organisation({ can_edit: false })}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByText("Coogee Beach")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /set as default/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/attach a location/i)).not.toBeInTheDocument();
  });

  it("shows a load failure rather than an empty list", async () => {
    mockedApi.organisationLocations.mockRejectedValue(
      new Error("Failed to load the locations."),
    );

    render(
      <OrganisationLocations
        organisation={organisation()}
        onOrganisationUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load the locations.",
    );
  });
});
