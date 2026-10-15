import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Tournament } from "../api";
import Tournaments from "./Tournaments";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, tournaments: vi.fn(), tournamentOptions: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 1,
  name: "Sand Series",
  organisation: { id: 3, name: "Beach Club", acronym: "BC" } as Tournament["organisation"],
  scope: "club", division_scheme: "letter", publication_state: "active",
  website_url: null, description: null, location_name: null, city: null, state: null, country: null,
  timezone: "America/New_York", all_day: false,
  starts_at: "2026-03-08T16:00:00Z", ends_at: "2026-03-08T19:00:00Z",
  created_by_account_id: 1, divisions: [], participations: [], watch_links: [], ...overrides,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(entry = "/tournaments?month=2026-03") {
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/tournaments" element={<><Tournaments /><LocationProbe /></>} />
    <Route path="/tournaments/:id" element={<div>Tournament detail</div>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.tournamentOptions.mockResolvedValue({ scopes: ["club"], schemes: ["letter"], ordered_levels: ["AA", "A"], participation_roles: ["player"] });
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
    await user.click(screen.getByRole("tab", { name: "List" }));
    expect(screen.getByTestId("location")).toHaveTextContent("view=list");
    await user.type(screen.getByLabelText("Search"), "open");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("search=open"));
    expect(mockedApi.tournaments).toHaveBeenLastCalledWith(expect.objectContaining({ search: "open" }), expect.anything());
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
});