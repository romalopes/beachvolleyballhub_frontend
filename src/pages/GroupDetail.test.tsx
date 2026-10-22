import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type GroupDetail, type GroupMember, type OrganisationMembership } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import GroupDetailPage from "./GroupDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      group: vi.fn(),
      addGroupMember: vi.fn(),
      updateGroupMember: vi.fn(),
      organisationMemberCandidates: vi.fn(),
      organisationMembers: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const ana: GroupMember = {
  id: 11,
  account_id: 10,
  memberable_type: "Account",
  memberable_id: 10,
  person_id: null,
  name: "Anderson Yahoo",
  player_profile_id: 14,
  level: null,
  preferred_position: null,
  email: null,
  role: "owner",
  status: "active",
  joined_at: "2026-09-01T00:00:00Z",
  left_at: null,
};

const group = (overrides: Partial<GroupDetail> = {}): GroupDetail => ({
  can_edit: true,
  can_archive: true,
  can_delete: true,
  id: 16,
  name: "U19 squad",
  slug: "u19-squad",
  description: "The under-19 training group",
  status: "active",
  status_label: "Active",
  visibility: "shared",
  requires_approval: false,
  approval_required: false,
  can_approve_members: true,
  player_count: 1,
  organisation: { id: 1, name: "Volleyball Club" },
  owner: { id: 2, name: "Coach Ana" },
  created_by: { id: 2, name: "Coach Ana" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  members: [ana],
  ...overrides,
});

const authValue = (roles: string[] = ["coach"]): AuthContextValue => ({
  user: { id: 1, email: "coach@example.com", roles } as unknown as AuthContextValue["user"],
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
});

const renderPage = (roles?: string[]) =>
  render(
    <AuthContext.Provider value={authValue(roles)}>
      <MemoryRouter initialEntries={["/groups/16"]}>
        <Routes>
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

const brunoCandidate = {
  id: "Account:20",
  memberable_type: "Account" as const,
  memberable_id: 20,
  account_id: 20,
  player_profile_id: null,
  coach_profile_id: null,
  display_name: "Bruno Alves",
  member_type_label: "Account",
  account_status: "active",
};

const orgMembership = (
  overrides: Partial<OrganisationMembership> = {},
): OrganisationMembership => ({
  id: 5,
  organisation_id: 1,
  account_id: 20,
  memberable_type: "Account",
  memberable_id: 20,
  display_name: "Bruno Alves",
  person_name: "Bruno Alves",
  role: "member",
  role_label: "Member",
  status: "active",
  status_label: "Active",
  manages: false,
  joined_at: "2026-09-01T00:00:00Z",
  left_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.group.mockResolvedValue({ group: group() } as never);
  // The organisation's active roster gates the candidate search: only these
  // subjects may ever be offered.
  mockedApi.organisationMembers.mockResolvedValue({
    organisation: { id: 1, name: "Volleyball Club" },
    data: [
      orgMembership({
        id: 4,
        account_id: 10,
        memberable_id: 10,
        display_name: "Anderson Yahoo",
        person_name: "Anderson Yahoo",
      }),
      orgMembership(),
    ],
  } as never);
});

describe("GroupDetail members", () => {
  it("searches the organisation roster and adds a member with the chosen role", async () => {
    const user = userEvent.setup();
    const bruno: GroupMember = {
      ...ana,
      id: 12,
      account_id: 20,
      memberable_id: 20,
      name: "Bruno Alves",
      player_profile_id: null,
      role: "member",
    };
    mockedApi.organisationMemberCandidates.mockResolvedValue([brunoCandidate] as never);
    mockedApi.addGroupMember.mockResolvedValue({
      group: group({ player_count: 2, members: [ana, bruno] }),
      added: 1,
    } as never);
    mockedApi.updateGroupMember.mockResolvedValue({
      membership: { ...bruno, role: "coach" },
    } as never);
    renderPage();
    expect(await screen.findByRole("link", { name: "Anderson Yahoo" })).toHaveAttribute(
      "href",
      "/players/14",
    );

    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.type(screen.getByLabelText("Search by name"), "Bru");
    await user.click(await screen.findByRole("button", { name: /^select$/i }));
    await user.selectOptions(screen.getByLabelText("Role"), "coach");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(mockedApi.addGroupMember).toHaveBeenCalledWith(16, { accountIds: [20] }),
    );
    await waitFor(() =>
      expect(mockedApi.updateGroupMember).toHaveBeenCalledWith(16, 12, "coach"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Bruno Alves added to U19 squad.",
    );
    // The roster updates in place: the new member and the applied role show
    // without a refetch.
    expect(screen.getByText("Bruno Alves")).toBeInTheDocument();
    expect(screen.getByText("Coach · active")).toBeInTheDocument();
  });

  it("refuses to submit without a selected member", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: "Anderson Yahoo" });

    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a person to add.",
    );
    expect(mockedApi.addGroupMember).not.toHaveBeenCalled();
  });

  it("marks a candidate already on the roster", async () => {
    const user = userEvent.setup();
    mockedApi.organisationMemberCandidates.mockResolvedValue([
      { ...brunoCandidate, id: "Account:10", memberable_id: 10, account_id: 10, display_name: "Anderson Yahoo" },
    ] as never);
    renderPage();
    await screen.findByRole("link", { name: "Anderson Yahoo" });

    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.type(screen.getByLabelText("Search by name"), "And");

    expect(
      await screen.findByRole("button", { name: /already on roster/i }),
    ).toBeDisabled();
  });

  it("only offers candidates who belong to the group's organisation", async () => {
    const user = userEvent.setup();
    mockedApi.organisationMemberCandidates.mockResolvedValue([
      brunoCandidate,
      {
        ...brunoCandidate,
        id: "Account:99",
        memberable_id: 99,
        account_id: 99,
        display_name: "Outsider Olive",
      },
    ] as never);
    renderPage();
    await screen.findByRole("link", { name: "Anderson Yahoo" });

    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.type(screen.getByLabelText("Search by name"), "bru");

    // The org roster gates the pool: Bruno is an active member of Volleyball
    // Club, Olive is not and never appears, whatever the search returns.
    expect(mockedApi.organisationMembers).toHaveBeenCalledWith(1);
    expect(await screen.findByText("Bruno Alves")).toBeInTheDocument();
    expect(screen.queryByText("Outsider Olive")).not.toBeInTheDocument();
  });

  it("hides the add-member affordance from users without authority", async () => {
    mockedApi.group.mockResolvedValue({
      group: group({ can_edit: false, can_approve_members: false }),
    } as never);
    renderPage(["player"]);
    await screen.findByRole("link", { name: "Anderson Yahoo" });
    expect(screen.queryByRole("button", { name: /add member/i })).not.toBeInTheDocument();
  });
});
