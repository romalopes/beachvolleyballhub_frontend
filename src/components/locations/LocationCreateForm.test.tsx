import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiValidationError, type Location } from "../../api";
import LocationCreateForm from "./LocationCreateForm";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: { ...actual.api, createLocation: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);
const createdLocation: Location = {
  id: 42,
  name: "Coogee Beach",
  location_type: "beach",
  formatted_address: null,
  locality: "Sydney",
  administrative_area: null,
  country_code: "AU",
  timezone: "Australia/Sydney",
  latitude: null,
  longitude: null,
  status: "active",
  verification_status: "proposed",
  geocoding_status: "pending",
  coordinate_source: null,
  map_url: null,
};

describe("LocationCreateForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates the required name without calling the API", async () => {
    render(<LocationCreateForm idPrefix="test" onCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Propose a new venue" }));
    await userEvent.click(screen.getByRole("button", { name: "Create venue proposal" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
    expect(mockedApi.createLocation).not.toHaveBeenCalled();
  });

  it("displays backend validation errors", async () => {
    mockedApi.createLocation.mockRejectedValue(new ApiValidationError(["Country code is the wrong length"]));
    render(<LocationCreateForm idPrefix="test" onCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Propose a new venue" }));
    await userEvent.type(screen.getByLabelText("Name *"), "Coogee Beach");
    await userEvent.type(screen.getByLabelText("Country code"), "A");
    await userEvent.click(screen.getByRole("button", { name: "Create venue proposal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Country code is the wrong length");
  });

  it("creates the proposal and returns it to the host form", async () => {
    const onCreated = vi.fn();
    mockedApi.createLocation.mockResolvedValue(createdLocation);
    render(<LocationCreateForm idPrefix="test" onCreated={onCreated} />);
    await userEvent.click(screen.getByRole("button", { name: "Propose a new venue" }));
    await userEvent.type(screen.getByLabelText("Name *"), "Coogee Beach");
    await userEvent.type(screen.getByLabelText("City / locality"), "Sydney");
    await userEvent.type(screen.getByLabelText("Country code"), "au");
    await userEvent.click(screen.getByRole("button", { name: "Create venue proposal" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdLocation));
    expect(mockedApi.createLocation).toHaveBeenCalledWith(expect.objectContaining({
      name: "Coogee Beach",
      locality: "Sydney",
      country_code: "AU",
    }));
  });
});