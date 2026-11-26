import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Tournament } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import TournamentFormPage from "./TournamentFormPage";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../api", async importOriginal => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      tournament: vi.fn(),
      tournamentOptions: vi.fn().mockResolvedValue({
        scopes: ["club", "state", "national", "international", "other"],
        schemes: ["letter", "numbered"],
        ordered_levels: ["A"],
        participation_roles: ["player", "coach", "referee", "organiser"],
      }),
      organisations: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }),
      locations: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }),
      locationCourts: vi.fn().mockResolvedValue([]),
      createLocation: vi.fn(),
      createDivision: vi.fn(),
      updateDivision: vi.fn(),
      deleteDivision: vi.fn(),
      createWatchLink: vi.fn(),
      updateWatchLink: vi.fn(),
      deleteWatchLink: vi.fn(),
      publishTournament: vi.fn(),
      archiveTournament: vi.fn(),
      cancelTournament: vi.fn(),
      restoreTournament: vi.fn(),
      deleteTournament: vi.fn(),
      createTournament: vi.fn(),
      updateTournament: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const organisation = {
  id: 2,
  name: "Beach Club",
  acronym: "BC",
  can_edit: false,
  can_delete: false,
  can_manage_members: false,
  can_approve_members: false,
  requires_approval: false,
  approval_required: false,
  organisation_type: "club",
  status: "active",
  status_label: "Active",
  slug: "beach-club",
  description: null,
  website: null,
  parent_organisation_id: null,
  parent_organisation: null,
  child_count: 0,
  depth: 0,
  logo_url: null,
  logo_attached: false,
  default_location: null,
  created_by_person: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
} as any;

const division = (overrides: Partial<any> = {}): any => ({
  id: 1,
  letter_level: "A",
  division_number: null,
  active: true,
  strength_order: 4,
  division_code: "A",
  ...overrides,
});

const watchLink = (overrides: Partial<any> = {}): any => ({
  id: 1,
  name: "Livestream",
  url: "https://example.com/stream",
  provider: "youtube",
  link_type: "youtube",
  description: null,
  starts_at: "2026-01-01T00:00:00Z",
  position: 0,
  active: true,
  ...overrides,
});

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 7,
  name: "Sand Series",
  organisation,
  scope: "club",
  division_scheme: "letter",
  publication_state: "active",
  website_url: null,
  description: null,
  location_name: null,
  timezone: "UTC",
  all_day: false,
  starts_at: "2026-07-10T16:00:00Z",
  ends_at: "2026-07-10T19:00:00Z",
  created_by_account_id: 1,
  divisions: [division()],
  participations: [],
  watch_links: [watchLink()],
  ...overrides,
});

const auth = (roles: string[] = ["player"], impersonation?: AuthContextValue["impersonation"]): AuthContextValue => ({
  user: {
    id: 1,
    name: "Regular User",
    email_address: "user@example.com",
    roles,
    account_id: 999, // Different from tournament creator
  },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: impersonation ?? { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
});

function renderPage(
  tournamentData: Tournament,
  roles: string[] = ["player"],
  impersonation?: AuthContextValue["impersonation"]
) {
  return render(
    <AuthContext.Provider value={auth(roles, impersonation)}>
      <MemoryRouter initialEntries={["/tournaments/7/edit"]}>
        <Routes>
          <Route path="/tournaments/:id/edit" element={<TournamentFormPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("TournamentFormPage authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error when user cannot edit tournament (can_edit is false)", async () => {
    const tournamentData = tournament({
      organisation: { ...organisation, can_edit: false },
    });
    mockedApi.tournament.mockResolvedValue(tournamentData);

    renderPage(tournamentData);

    await waitFor(() => {
      expect(screen.getByText(/You don't have permission to edit this tournament/)).toBeInTheDocument();
    });
  });

  it("shows form when user can edit tournament (can_edit is true)", async () => {
    const tournamentData = tournament({
      organisation: { ...organisation, can_edit: true },
    });
    mockedApi.tournament.mockResolvedValue(tournamentData);

    renderPage(tournamentData);

    await waitFor(() => {
      expect(screen.getByText("Edit Tournament")).toBeInTheDocument();
      expect(screen.queryByText("You don't have permission to edit this tournament")).not.toBeInTheDocument();
    });
  });

  it("shows form for admin user", async () => {
    const tournamentData = tournament({
      organisation: { ...organisation, can_edit: false },
    });
    mockedApi.tournament.mockResolvedValue(tournamentData);

    renderPage(tournamentData, ["admin"]);

    await waitFor(() => {
      expect(screen.getByText("Edit Tournament")).toBeInTheDocument();
    });
  });

  it("shows form for tournament creator even when can_edit is false (fallback)", async () => {
    const tournamentData = tournament({
      organisation: { ...organisation, can_edit: false },
      created_by_account_id: 999, // Matches the test user's account_id
    });
    mockedApi.tournament.mockResolvedValue(tournamentData);

    renderPage(tournamentData);

    await waitFor(() => {
      expect(screen.getByText("Edit Tournament")).toBeInTheDocument();
      expect(screen.queryByText(/You don't have permission to edit/)).not.toBeInTheDocument();
    });
  });

  // --- Impersonation tests ---

  it("shows form for real admin impersonating a regular user", async () => {
    const tournamentData = tournament({
      organisation: { ...organisation, can_edit: false },
    });
    mockedApi.tournament.mockResolvedValue(tournamentData);

    renderPage(
      tournamentData,
      ["player"], // Effective user is a regular player
      { active: true, realAdmin: { id: 99, name: "Real Admin", email_address: "admin@example.com" } }
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Tournament")).toBeInTheDocument();
      expect(screen.queryByText(/You don't have permission to edit/)).not.toBeInTheDocument();
    });
  });

  it("hides form for regular user impersonating an admin (effective user permissions apply)", async () => {
    const tournamentData = tournament({
      organisation: { ...organisation, can_edit: false },
    });
    mockedApi.tournament.mockResolvedValue(tournamentData);

    renderPage(
      tournamentData,
      ["admin"], // Effective user has admin role (impersonating admin)
      { active: true, realAdmin: null } // But NOT a real admin (no real_admin)
    );

    await waitFor(() => {
      expect(screen.getByText(/You don't have permission to edit this tournament/)).toBeInTheDocument();
    });
  });
});