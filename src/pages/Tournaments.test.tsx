import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Tournament } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import Tournaments from "./Tournaments";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, tournaments: vi.fn(), tournamentOptions: vi.fn(), organisations: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const auth = (user: AuthContextValue["user"] = null): AuthContextValue => ({ user, loading: false, login: vi.fn(), register: vi.fn(), resetPassword: vi.fn(), logout: vi.fn(), impersonation: { active: false, realAdmin: null }, startImpersonating: vi.fn(), stopImpersonating: vi.fn() });
const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 1,
  name: "Sand Series",
  organisation: { id: 3, name: "Beach Club", acronym: "BC" } as Tournament["organisation"],
  scope: "club", division_scheme: "letter", publication_state: "active",
  website_url: null, description: null, location_name: null,
  timezone: "America/New_York", all_day: false,
  starts_at: "2026-03-08T16:00:00Z", ends_at: "2026-03-08T19:00:00Z",
  created_by_account_id: 1, divisions: [], participations: [], watch_links: [], ...overrides,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(entry = "/tournaments?month=2026-03") {
  return render(<AuthContext.Provider value={auth()}>
    <MemoryRouter initialEntries={[entry]}><Routes>
      <Route path="/tournaments" element={<><Tournaments /><LocationProbe /></>} />
      <Route path="/tournaments/:id" element={<div>Tournament detail</div>} />
    </Routes></MemoryRouter>
  </AuthContext.Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.tournamentOptions.mockResolvedValue({ scopes: ["club"], schemes: ["letter"], ordered_levels: ["AA", "A"], participation_roles: ["player"] });
  mockedApi.organisations.mockResolvedValue({
    data: [{ id: 3, name: "Beach Club", depth: 0 }, { id: 8, name: "State Volleyball", depth: 0 }],
    meta: { page: 1, per_page: 2, total: 2, total_pages: 1 },
  } as Awaited<ReturnType<typeof api.organisations>>);
  mockedApi.tournaments.mockResolvedValue({ data: [tournament()], meta: { page: 1, per_page: 100, total: 1, total_pages: 1 } });
});

describe("Tournaments directory", () => {
  it("uses the complete calendar grid range and opens event details", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Sand Series")).toBeInTheDocument();
    expect(mockedApi.tournaments).toHaveBeenCalledWith(expect.objectContaining({ starts_at: "2026-03-01", ends_at: "2026-04-05", page: 1, per_page: 100 }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await user.click(screen.getByRole("button", { name: /sand series/i }));
    expect(await screen.findByText("Tournament detail")).toBeInTheDocument();
  });

  it("synchronizes view and filters into the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sand Series");
    const viewTabs = screen.getByRole("tablist", { name: "Tournament view" });
    expect(viewTabs.querySelectorAll("svg")).toHaveLength(2);
    await user.click(screen.getByRole("tab", { name: "List" }));
    expect(screen.getByTestId("location")).toHaveTextContent("view=list");
    await user.type(screen.getByLabelText("Search"), "open");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("search=open"));
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(expect.objectContaining({ search: "open" }), expect.anything());
  });

  it("shows month and week controls after the view controls in calendar mode", async () => {
    renderPage();
    await screen.findByText("Sand Series");

    const toolbar = document.querySelector(".tournament-calendar-nav");
    expect(toolbar).not.toBeNull();
    const tablists = within(toolbar as HTMLElement).getAllByRole("tablist");

    expect(tablists).toHaveLength(2);
    expect(tablists[0]).toHaveAccessibleName("Tournament view");
    expect(tablists[1]).toHaveAccessibleName("Calendar range");
    expect(within(tablists[0]).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "List",
      "Calendar",
    ]);
    expect(within(tablists[1]).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Month",
      "Week",
    ]);
  });

  it("switches the calendar to a URL-driven week and navigates by week", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sand Series");

    await user.click(screen.getByRole("tab", { name: "Week" }));

    expect(screen.getByTestId("location")).toHaveTextContent("range=week");
    expect(screen.getByTestId("location")).toHaveTextContent("cursor=2026-03-01");
    expect(screen.getByText("Week of Mar 1, 2026")).toBeInTheDocument();
    expect(document.querySelector(".tournament-calendar.calendar--week")).not.toBeNull();
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        starts_at: "2026-03-01",
        ends_at: "2026-03-08",
      }),
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(screen.getByText("Week of Mar 8, 2026")).toBeInTheDocument();
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        starts_at: "2026-03-08",
        ends_at: "2026-03-15",
      }),
      expect.anything(),
    );
  });

  it("keeps list mode month-based after selecting a calendar week", async () => {
    const user = userEvent.setup();
    renderPage("/tournaments?range=week&cursor=2026-03-18&month=2026-03");
    await screen.findByRole("heading", { name: "Week of Mar 18, 2026" });

    await user.click(screen.getByRole("tab", { name: "List" }));

    expect(screen.getByRole("heading", { name: "March 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Calendar range" })).not.toBeInTheDocument();
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        starts_at: "2026-03-01",
        ends_at: "2026-04-05",
      }),
      expect.anything(),
    );
  });

  it("filters by multiple searched organisations", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Organisations"), "beach");
    await user.click(await screen.findByRole("option", { name: /beach club/i }));
    await user.type(screen.getByLabelText("Organisations"), "state");
    await user.click(await screen.findByRole("option", { name: /state volleyball/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("organisation_ids=3%2C8"),
    );
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
      expect.objectContaining({ organisation_ids: ["3", "8"] }),
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Remove Beach Club" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("organisation_ids=8"));
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
      expect.objectContaining({ organisation_ids: ["8"] }),
      expect.anything(),
    );
  });

  it("cancels stale requests when the filter changes", async () => {
    let firstSignal: AbortSignal | undefined;
    mockedApi.tournaments.mockImplementationOnce((_filters, request) => new Promise(resolve => {
      firstSignal = request?.signal;
      window.setTimeout(() => resolve({ data: [tournament({ name: "Stale tournament" })], meta: { page: 1, per_page: 100, total: 1, total_pages: 1 } }), 20);
    }));
    mockedApi.tournaments.mockResolvedValue({ data: [tournament({ name: "Fresh tournament" })], meta: { page: 1, per_page: 100, total: 1, total_pages: 1 } });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search"), "fresh");
    expect(await screen.findByText("Fresh tournament")).toBeInTheDocument();
    expect(firstSignal?.aborted).toBe(true);
    await new Promise(resolve => window.setTimeout(resolve, 30));
    expect(screen.queryByText("Stale tournament")).not.toBeInTheDocument();
  });

  it("groups the list view into calendar weeks", async () => {
    mockedApi.tournaments.mockResolvedValue({
      data: [
        tournament({ id: 1, name: "Week one tournament", starts_at: "2026-03-08T16:00:00Z", ends_at: "2026-03-08T19:00:00Z" }),
        tournament({ id: 2, name: "Week two tournament", starts_at: "2026-03-18T16:00:00Z", ends_at: "2026-03-18T19:00:00Z" }),
      ],
      meta: { page: 1, per_page: 100, total: 2, total_pages: 1 },
    });

    renderPage("/tournaments?view=list&month=2026-03");

    expect(await screen.findByText("Week from Mar 2 to Mar 8")).toBeInTheDocument();
    expect(screen.getByText("Week from Mar 16 to Mar 22")).toBeInTheDocument();
    expect(screen.getByText("Week one tournament")).toBeInTheDocument();
    expect(screen.getByText("Week two tournament")).toBeInTheDocument();
  });
});
