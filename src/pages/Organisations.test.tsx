import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Location, type Organisation } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { paginated } from "../test/paginated";
import OrganisationDetail from "./OrganisationDetail";
import Organisations from "./Organisations";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      organisations: vi.fn(),
      organisation: vi.fn(),
      createOrganisation: vi.fn(),
      updateOrganisation: vi.fn(),
      archiveOrganisation: vi.fn(),
      restoreOrganisation: vi.fn(),
      deleteOrganisation: vi.fn(),
      uploadOrganisationLogo: vi.fn(),
      organisationMembers: vi.fn(),
      organisationMemberCandidates: vi.fn(),
      organisationLocations: vi.fn(),
      createOrganisationLocation: vi.fn(),
      destroyOrganisationLocation: vi.fn(),
      locations: vi.fn(),
      createLocation: vi.fn(),
      verifyLocation: vi.fn(),
      addOrganisationMember: vi.fn(),
      updateOrganisationMember: vi.fn(),
      updateOrganisationMembership: vi.fn(),
      endOrganisationMember: vi.fn(),
      endOrganisationMembership: vi.fn(),
      approveOrganisationMembership: vi.fn(),
      rejectOrganisationMembership: vi.fn(),
      groups: vi.fn(),
      createGroup: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const organisation = (overrides: Partial<Organisation> = {}): Organisation => ({
  id: 1,
  name: "FIVB",
  slug: "fivb",
  description: null,
  acronym: null,
  organisation_type: "international_federation",
  status: "active",
  status_label: "Active",
  parent_organisation_id: null,
  parent_organisation: null,
  child_count: 0,
  depth: 0,
  logo_url: null,
  logo_attached: false,
  can_edit: false,
  can_delete: false,
  can_manage_members: false,
  can_approve_members: false,
  requires_approval: false,
  approval_required: false,
  created_by_person: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const membership = (overrides = {}) => ({
  id: 10,
  organisation_id: 1,
  person_id: 10,
  person_name: "Alex Owner",
  role: "owner" as const,
  role_label: "Owner",
  status: "active" as const,
  status_label: "Active",
  joined_at: null,
  left_at: null,
  manages: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const authValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
  ...overrides,
});

const adminUser = { id: 1, email: "admin@example.com", roles: ["admin"] } as unknown as AuthContextValue["user"];

const location = (overrides: Partial<Location> = {}): Location => ({
  id: 5,
  name: "Coogee Beach",
  location_type: "beach",
  formatted_address: null,
  locality: "Sydney",
  administrative_area: "NSW",
  country_code: "AU",
  timezone: "Australia/Sydney",
  latitude: null,
  longitude: null,
  status: "active",
  verification_status: "verified",
  geocoding_status: "not_requested",
  coordinate_source: null,
  map_url: null,
  ...overrides,
});

const renderWithAuth = (
  ui: React.ReactElement,
  auth: AuthContextValue = authValue(),
  route = "/organisations",
  path = "/organisations",
) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("Organisations tree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedApi.organisations.mockResolvedValue(paginated([organisation()]));
    // The organisation detail page lists the venues attached to it. An empty
    // list keeps the assertions below about the roster unambiguous.
    mockedApi.organisationLocations.mockResolvedValue({ locations: [] });
    mockedApi.locations.mockResolvedValue(paginated([]));
  });

  it("renders organisations as links to their detail pages", async () => {
    renderWithAuth(<Organisations />);

    expect(screen.getByRole("heading", { name: "Organisations" })).toBeInTheDocument();
    expect(screen.getByText("Browse the hierarchy")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "FIVB" });
    expect(link).toHaveAttribute("href", "/organisations/1");
  });

  it("renders and collapses nested organisations", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({ id: 1, name: "FIVB", child_count: 1 }),
        organisation({ id: 2, name: "Volleyball Australia", parent_organisation_id: 1 }),
      ]),
    );
    renderWithAuth(<Organisations />);

    expect(await screen.findByRole("link", { name: "Volleyball Australia" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /collapse fivb/i }));
    expect(screen.queryByRole("link", { name: "Volleyball Australia" })).not.toBeInTheDocument();
  });

  it("passes search and archived filters to the list request", async () => {
    renderWithAuth(<Organisations />);
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: /all statuses/i }));

    await waitFor(() => expect(mockedApi.organisations).toHaveBeenLastCalledWith(undefined, undefined, true));
  });

  it("lets admins create a new organisation", async () => {
    mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 2, name: "New Club" }));
    renderWithAuth(<Organisations />, authValue({ user: adminUser }));
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: /new organisation/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "New Club");
    await userEvent.click(screen.getByLabelText(/require approval for new members/i));
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockedApi.createOrganisation).toHaveBeenCalledWith(expect.objectContaining({
      name: "New Club",
      requires_approval: true,
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("New Club created.");
  });

  it("creates an open organisation when approval is not selected", async () => {
    mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 2, name: "Open Club" }));
    renderWithAuth(<Organisations />, authValue({ user: adminUser }));
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: /new organisation/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "Open Club");
    expect(screen.getByLabelText(/require approval for new members/i)).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockedApi.createOrganisation).toHaveBeenCalledWith(expect.objectContaining({
      name: "Open Club",
      requires_approval: false,
    }));
  });

  it("searches for and selects a default location while creating an organisation", async () => {
    mockedApi.locations.mockResolvedValue(paginated([location()]));
    mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 2, name: "Coogee Club" }));
    renderWithAuth(<Organisations />, authValue({ user: adminUser }));
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: /new organisation/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "Coogee Club");
    await userEvent.type(screen.getByLabelText("Search locations"), "Coogee");
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockedApi.locations).toHaveBeenCalledWith(expect.objectContaining({
      q: "Coogee",
      verification_status: "verified",
      status: "active",
    }));
    expect(mockedApi.createOrganisation).toHaveBeenCalledWith(expect.objectContaining({
      name: "Coogee Club",
      default_location_id: 5,
    }));
  });

  it("creates, verifies, and selects a new default location", async () => {
    const proposal = location({ id: 9, name: "Newport Beach", verification_status: "proposed" });
    const verified = location({ id: 9, name: "Newport Beach" });
    mockedApi.createLocation.mockResolvedValue(proposal);
    mockedApi.verifyLocation.mockResolvedValue(verified);
    mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 2, name: "Newport Club" }));
    renderWithAuth(<Organisations />, authValue({ user: adminUser }));
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: /new organisation/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "Newport Club");
    await userEvent.click(screen.getByRole("button", { name: "Propose a new venue" }));
    await userEvent.type(screen.getByLabelText("Name *"), "Newport Beach");
    await userEvent.click(screen.getByRole("button", { name: "Create venue proposal" }));
    expect(await screen.findByText(
      "Newport Beach created and selected as the default location.",
    )).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockedApi.verifyLocation).toHaveBeenCalledWith(9);
    expect(mockedApi.createOrganisation).toHaveBeenCalledWith(expect.objectContaining({
      name: "Newport Club",
      default_location_id: 9,
    }));
  });
});

describe("Organisation detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.organisation.mockResolvedValue(organisation({ can_edit: true, can_delete: true, can_manage_members: true }));
    mockedApi.organisations.mockResolvedValue(paginated([organisation({ can_edit: true, can_delete: true, can_manage_members: true })]));
    mockedApi.organisationMembers.mockResolvedValue({ organisation: { id: 1, name: "FIVB" }, data: [membership()] });
    mockedApi.groups.mockResolvedValue(paginated([]));
  });

  it("loads details and roster", async () => {
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");

    expect(await screen.findByRole("heading", { name: "FIVB" })).toBeInTheDocument();
    expect(await screen.findByText("Alex Owner")).toBeInTheDocument();
  });

  it("creates a group for the current organisation from the detail card", async () => {
    const user = userEvent.setup();
    const organisation16 = organisation({ id: 16, name: "Northern Club" });
    mockedApi.organisation.mockResolvedValue(organisation16);
    mockedApi.organisations.mockResolvedValue(paginated([organisation16]));
    mockedApi.createGroup.mockResolvedValue({
      group: {
        id: 31,
        name: "Monday squad",
        slug: "monday-squad",
        description: "Development roster",
        status: "active",
        status_label: "Active",
        visibility: "private",
        requires_approval: true,
        approval_required: true,
        can_approve_members: true,
        player_count: 0,
        organisation: { id: 16, name: "Northern Club" },
        owner: null,
        created_by: null,
        created_at: "2026-10-22T00:00:00Z",
        updated_at: "2026-10-22T00:00:00Z",
        members: [],
      },
    });

    renderWithAuth(
      <OrganisationDetail />,
      authValue({ user: { id: 7, email: "coach@example.com", roles: ["coach"] } as unknown as AuthContextValue["user"] }),
      "/organisations/16",
      "/organisations/:id",
    );

    expect(await screen.findByRole("heading", { name: "Create a group" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^name$/i), "Monday squad");
    await user.type(screen.getByLabelText(/^description$/i), "Development roster");
    await user.selectOptions(screen.getByLabelText(/^visibility$/i), "private");
    await user.click(screen.getByLabelText(/require approval for new members/i));
    await user.click(screen.getByRole("button", { name: /create group/i }));

    expect(mockedApi.createGroup).toHaveBeenCalledWith({
      name: "Monday squad",
      description: "Development roster",
      visibility: "private",
      organisation_id: 16,
      requires_approval: true,
    });
    expect(await screen.findByRole("link", { name: "Monday squad" })).toHaveAttribute("href", "/groups/31");
    expect(screen.getByRole("status")).toHaveTextContent("Monday squad created.");
  });

  it("does not show the group creation card to users without a group creator role", async () => {
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByRole("heading", { name: "FIVB" });
    expect(screen.queryByRole("heading", { name: "Create a group" })).not.toBeInTheDocument();
  });

  it("edits organisation details", async () => {
    mockedApi.updateOrganisation.mockResolvedValue(organisation({ name: "FIVB Renamed", can_edit: true }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByRole("heading", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText(/^name$/i);
    await userEvent.clear(name);
    await userEvent.type(name, "FIVB Renamed");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(1, expect.objectContaining({ name: "FIVB Renamed" }));
    expect(await screen.findByRole("status")).toHaveTextContent("FIVB Renamed updated.");
  });

  it("updates a roster member role", async () => {
    mockedApi.updateOrganisationMembership.mockResolvedValue(membership({ role: "coach", role_label: "Coach" }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByText("Alex Owner");

    await userEvent.selectOptions(screen.getByLabelText("Role for Alex Owner"), "coach");

    expect(mockedApi.updateOrganisationMembership).toHaveBeenCalledWith(1, 10, { role: "coach" });
    expect(await screen.findByRole("status")).toHaveTextContent("Alex Owner is now Coach.");
  });

  it("adds a searched polymorphic candidate to the roster", async () => {
    mockedApi.organisationMemberCandidates.mockResolvedValue([{ id: "PlayerProfile:77", memberable_type: "PlayerProfile", memberable_id: 77, account_id: null, player_profile_id: 77, coach_profile_id: null, display_name: "Rosa New", member_type_label: "Player profile", account_status: "profile_only" }]);
    mockedApi.addOrganisationMember.mockResolvedValue(membership({ id: 77, memberable_type: "PlayerProfile", memberable_id: 77, person_name: "Rosa New", display_name: "Rosa New", role: "member", role_label: "Member" }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByText("Alex Owner");

    await userEvent.click(screen.getByRole("button", { name: /add someone/i }));
    await userEvent.type(screen.getByPlaceholderText("Search by name"), "Ro");
    const row = await screen.findByText("Rosa New");
    await userEvent.click(within(row.closest("li") as HTMLElement).getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mockedApi.organisationMemberCandidates).toHaveBeenCalledWith(1, "Ro");
    expect(mockedApi.addOrganisationMember).toHaveBeenCalledWith(1, { memberable_type: "PlayerProfile", memberable_id: 77 }, { role: "member" });
    expect(await screen.findByRole("status")).toHaveTextContent("Rosa New added to the roster.");
  });
});

describe("Pending organisation requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.organisation.mockResolvedValue(organisation({ can_approve_members: true }));
    mockedApi.organisations.mockResolvedValue(paginated([organisation()]));
    mockedApi.organisationMembers.mockResolvedValue({ organisation: { id: 1, name: "FIVB" }, data: [membership({ id: 42, person_id: 10, status: "pending", status_label: "Pending" })] });
    mockedApi.groups.mockResolvedValue(paginated([]));
  });

  it("approves by membership ID and moves the request into active members", async () => {
    mockedApi.approveOrganisationMembership.mockResolvedValue({ membership: membership({ id: 42 }) });
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    expect(await screen.findByText("Pending requests (1)")).toBeInTheDocument();
    expect(screen.getByText("Active members (0)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(mockedApi.approveOrganisationMembership).toHaveBeenCalledWith(1, 42);
    expect(await screen.findByText("Active members (1)")).toBeInTheDocument();
    expect(screen.queryByText("Pending requests (1)")).not.toBeInTheDocument();
  });

  it("rejects a pending request and removes it", async () => {
    mockedApi.rejectOrganisationMembership.mockResolvedValue({ removed: true, membership_id: 42 });
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(mockedApi.rejectOrganisationMembership).toHaveBeenCalledWith(1, 42);
    await waitFor(() => expect(screen.queryByText("Pending requests (1)")).not.toBeInTheDocument());
  });

  it("keeps the request visible when approval fails", async () => {
    mockedApi.approveOrganisationMembership.mockRejectedValue(new Error("Approval denied"));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Approval denied");
    expect(screen.getByText("Pending requests (1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("does not offer decisions without approval permission", async () => {
    mockedApi.organisation.mockResolvedValue(organisation({ can_manage_members: true, can_approve_members: false }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByText("Pending requests (1)");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});
