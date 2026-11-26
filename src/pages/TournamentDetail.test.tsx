import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Tournament } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import TournamentDetail from "./TournamentDetail";

vi.mock("../api", async importOriginal => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, tournament: vi.fn(), participateTournament: vi.fn(), leaveTournament: vi.fn() } };
});
const mockedApi = vi.mocked(api, true);
const auth = (user: AuthContextValue["user"] = null, impersonation?: AuthContextValue["impersonation"]): AuthContextValue => ({ user, loading: false, login: vi.fn(), register: vi.fn(), resetPassword: vi.fn(), logout: vi.fn(), impersonation: impersonation ?? { active: false, realAdmin: null }, startImpersonating: vi.fn(), stopImpersonating: vi.fn() });
const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({ id: 7, name: "Sand Series", organisation: { id: 2, name: "Beach Club", acronym: "BC", can_edit: false } as Tournament["organisation"], scope: "club", division_scheme: "letter", publication_state: "active", website_url: null, description: null, location_name: "Main court", timezone: "America/New_York", all_day: false, starts_at: "2027-07-10T16:00:00Z", ends_at: "2027-07-10T19:00:00Z", created_by_account_id: 1, divisions: [{ id: 1, letter_level: "A", division_number: null, active: true, strength_order: 4, division_code: "A" }, { id: 2, letter_level: "B", division_number: null, active: false, strength_order: 7, division_code: "B" }], participations: [], my_participation: null, watch_links: [], ...overrides });
function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function renderPage(currentUser: AuthContextValue["user"] = null, impersonation?: AuthContextValue["impersonation"]) { return render(<AuthContext.Provider value={auth(currentUser, impersonation)}><MemoryRouter initialEntries={["/tournaments/7"]}><Routes><Route path="/tournaments/:id" element={<><TournamentDetail /><LocationProbe /></>} /><Route path="/login" element={<LocationProbe />} /></Routes></MemoryRouter></AuthContext.Provider>); }
beforeEach(() => { vi.clearAllMocks(); mockedApi.tournament.mockResolvedValue(tournament()); });

describe("TournamentDetail", () => {
  it("sends guests to sign-in while preserving the detail return path", async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole("button", { name: /sign in to add participation/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("saves selected active divisions and refreshes detail for an authenticated account", async () => {
    const user = userEvent.setup(); mockedApi.participateTournament.mockResolvedValue({ id: 3, account_id: 1, role: "player", created_at: "2027-01-01", division_ids: [1] });
    renderPage({ id: 1, name: "Bea", email_address: "bea@example.com", roles: ["player"], account_id: 1 });
    await screen.findByText("Your participation"); await user.click(screen.getByRole("checkbox", { name: "A" })); await user.click(screen.getByRole("button", { name: "Add participation" }));
    await waitFor(() => expect(mockedApi.participateTournament).toHaveBeenCalledWith(7, { role: "player", division_ids: [1] }));
    expect(mockedApi.tournament).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("checkbox", { name: "B (inactive)" })).toBeDisabled();
  });

  it("keeps cancelled events read-only but permits unlinking existing participation", async () => {
    const user = userEvent.setup(); mockedApi.tournament.mockResolvedValue(tournament({ publication_state: "cancelled", my_participation: { id: 3, account_id: 1, role: "player", created_at: "2027-01-01", division_ids: [2] } })); mockedApi.leaveTournament.mockResolvedValue(undefined);
    renderPage({ id: 1, name: "Bea", email_address: "bea@example.com", roles: ["player"], account_id: 1 });
    expect(await screen.findByText(/has been cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /update participation/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove my participation/i }));
    await waitFor(() => expect(mockedApi.leaveTournament).toHaveBeenCalledWith(7));
  });

  it("renders the canonical address and reusable map when coordinates are available", async () => {
    mockedApi.tournament.mockResolvedValue(tournament({
      location: {
        id: 4, name: "Coogee Beach", slug: "coogee-beach", location_type: "beach",
        formatted_address: "Coogee Beach, Sydney NSW, Australia", locality: "Sydney",
        administrative_area: "NSW", country_code: "AU", timezone: "Australia/Sydney",
        latitude: -33.9167, longitude: 151.25, status: "active",
        verification_status: "verified", geocoding_status: "resolved",
        coordinate_source: "geoapify", map_url: "https://www.google.com/maps/search/?api=1&query=-33.9167,151.25",
      },
    }));
    renderPage();

    expect(await screen.findByText("Coogee Beach, Sydney NSW, Australia")).toBeInTheDocument();
    expect(screen.getByText("Map preview is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toBeInTheDocument();
  });

  it("keeps a free-text historical venue without rendering a map", async () => {
    renderPage();
    expect(await screen.findByText("Main court")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Map" })).not.toBeInTheDocument();
  });

  // --- Edit button authorization tests ---

  it("shows Edit button for tournament creator", async () => {
    renderPage({ id: 1, name: "Creator", email_address: "creator@example.com", roles: ["player"], account_id: 1 });
    await screen.findByText("Sand Series");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("hides Edit button for regular user who is not creator, not admin, not org member", async () => {
    renderPage({ id: 1, name: "Regular User", email_address: "user@example.com", roles: ["player"], account_id: 999 });
    await screen.findByText("Sand Series");
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("hides Edit button for organisation member who is not owner/admin", async () => {
    renderPage({ id: 1, name: "Org Member", email_address: "member@example.com", roles: ["player"], account_id: 999 });
    await screen.findByText("Sand Series");
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("shows Edit button for admin user", async () => {
    renderPage({ id: 1, name: "Admin", email_address: "admin@example.com", roles: ["admin"], account_id: 999 });
    await screen.findByText("Sand Series");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("shows Edit button when organisation.can_edit is true", async () => {
    mockedApi.tournament.mockResolvedValue(tournament({ organisation: { id: 2, name: "Beach Club", acronym: "BC", can_edit: true } }));
    renderPage({ id: 1, name: "Org Admin", email_address: "orgadmin@example.com", roles: ["player"], account_id: 999 });
    await screen.findByText("Sand Series");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  // --- Impersonation tests ---

  it("shows Edit button for real admin impersonating a regular user", async () => {
    renderPage(
      { id: 1, name: "Regular User", email_address: "user@example.com", roles: ["player"], account_id: 999 },
      { active: true, realAdmin: { id: 99, name: "Real Admin", email_address: "admin@example.com" } }
    );
    await screen.findByText("Sand Series");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("hides Edit button for regular user impersonating an admin (effective user permissions apply)", async () => {
    renderPage(
      { id: 1, name: "Impersonated Admin", email_address: "impersonated@example.com", roles: ["admin"], account_id: 999 },
      { active: true, realAdmin: null }
    );
    await screen.findByText("Sand Series");
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
});