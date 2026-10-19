import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type Division,
  type Organisation,
  type Tournament,
  type WatchLink,
} from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import TournamentForm from "./TournamentForm";

vi.mock("../api", async importOriginal => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      tournamentOptions: vi.fn(),
      organisations: vi.fn(),
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
    },
  };
});

const mockedApi = vi.mocked(api, true);

const organisation = {
  id: 2,
  name: "Beach Club",
  acronym: "BC",
} as Organisation;

const division = (overrides: Partial<Division> = {}): Division => ({
  id: 1,
  letter_level: "A",
  division_number: null,
  active: true,
  strength_order: 4,
  division_code: "A",
  ...overrides,
});

const watchLink = (overrides: Partial<WatchLink> = {}): WatchLink => ({
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
  city: null,
  state: null,
  country: null,
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

const auth = (roles: string[] = ["admin"]): AuthContextValue => ({
  user: {
    id: 1,
    name: "Admin",
    email_address: "admin@example.com",
    roles,
    account_id: 1,
  },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
});

function renderForm(initial: Tournament) {
  return render(
    <AuthContext.Provider value={auth()}>
      <TournamentForm initial={initial} onCancel={vi.fn()} onSuccess={vi.fn()} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.tournamentOptions.mockResolvedValue({
    scopes: ["club", "state", "national", "international", "other"],
    schemes: ["letter", "numbered"],
    ordered_levels: ["A"],
    participation_roles: ["player", "coach", "referee", "organiser"],
  });
  mockedApi.organisations.mockResolvedValue({
    data: [organisation],
    meta: { page: 1, per_page: 25, total: 1, total_pages: 1 },
  } as never);
});

describe("TournamentForm (edit mode)", () => {
  it("renders division, watch-link and lifecycle management sections", async () => {
    renderForm(tournament());

    expect(await screen.findByRole("heading", { name: "Divisions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watch links" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lifecycle" })).toBeInTheDocument();
    expect(screen.getByText(/Livestream/)).toBeInTheDocument();
  });

  it("adds a division through the API", async () => {
    mockedApi.createDivision.mockResolvedValue(
      division({ id: 2, letter_level: null, division_number: 2, division_code: "2" }),
    );
    renderForm(tournament({ division_scheme: "numbered" }));

    await screen.findByRole("heading", { name: "Divisions" });
    await userEvent.type(screen.getByPlaceholderText(/Number/), "2");
    await userEvent.click(screen.getByRole("button", { name: "Add division" }));

    await waitFor(() =>
      expect(mockedApi.createDivision).toHaveBeenCalledWith(7, { division_number: 2 }),
    );
  });

  it("preserves legacy letter tournaments without offering new letter divisions", async () => {
    renderForm(tournament());
    expect(await screen.findByLabelText("Division Scheme")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add division" })).not.toBeInTheDocument();
  });

  it("cancels a tournament after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApi.cancelTournament.mockResolvedValue(tournament({ publication_state: "cancelled" }));
    renderForm(tournament({ division_scheme: "numbered" }));

    await screen.findByRole("heading", { name: "Lifecycle" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel tournament" }));

    await waitFor(() => expect(mockedApi.cancelTournament).toHaveBeenCalledWith(7));
  });
});

describe("TournamentForm (create)", () => {
  const paginated = (data: Organisation[]) =>
    ({
      data,
      meta: { page: 1, per_page: 25, total: data.length, total_pages: 1 },
    }) as never;

  // The server stamps `can_edit` per organisation: owner/administrator (or
  // oversight) only. The form's picker must mirror that judgement.
  const managed = { ...organisation, id: 2, can_edit: true };
  const plainMembership = { ...organisation, id: 3, name: "Member Club", can_edit: false };

  function renderCreateForm(roles: string[]) {
    return render(
      <AuthContext.Provider value={auth(roles)}>
        <TournamentForm initial={null} onCancel={vi.fn()} onSuccess={vi.fn()} />
      </AuthContext.Provider>,
    );
  }

  it("offers an ordinary user only the organisations they own or administer", async () => {
    mockedApi.organisations.mockResolvedValue(paginated([managed, plainMembership]));
    renderCreateForm(["player"]);

    // A non-admin asks for their own memberships (`mine`), not the whole tree.
    await waitFor(() =>
      expect(mockedApi.organisations).toHaveBeenCalledWith(
        "active", undefined, false, true,
      ),
    );
    const select = await screen.findByLabelText("Organisation *");
    expect(
      within(select).getByRole("option", { name: "Beach Club" }),
    ).toBeInTheDocument();
    expect(
      within(select).queryByRole("option", { name: "Member Club" }),
    ).not.toBeInTheDocument();
  });

  it("offers a site admin every active organisation", async () => {
    mockedApi.organisations.mockResolvedValue(paginated([managed, plainMembership]));
    renderCreateForm(["admin"]);

    await waitFor(() =>
      expect(mockedApi.organisations).toHaveBeenCalledWith(
        "active", undefined, false, false,
      ),
    );
    const select = await screen.findByLabelText("Organisation *");
    expect(
      within(select).getByRole("option", { name: "Member Club" }),
    ).toBeInTheDocument();
  });

  it("explains the empty picker to a user with no officer seats", async () => {
    mockedApi.organisations.mockResolvedValue(paginated([plainMembership]));
    renderCreateForm(["player"]);

    expect(
      await screen.findByText(
        /organisations where you are the owner or an administrator/,
      ),
    ).toBeInTheDocument();
  });
});
