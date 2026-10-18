import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Tournament } from "../api";
import MyTournaments from "./MyTournaments";

vi.mock("../api", async importOriginal => { const actual = await importOriginal<typeof import("../api")>(); return { ...actual, api: { ...actual.api, tournaments: vi.fn() } }; });
const mockedApi = vi.mocked(api, true);
const tournament = (id: number, startsAt: string, endsAt: string): Tournament => ({ id, name: `Tournament ${id}`, organisation: { id: 1, name: "Beach Club", acronym: "BC" } as Tournament["organisation"], scope: "club", division_scheme: "letter", publication_state: "active", website_url: null, description: null, location_name: null, city: null, state: null, country: null, timezone: "UTC", all_day: false, starts_at: startsAt, ends_at: endsAt, created_by_account_id: 1, divisions: [], participations: [], watch_links: [] });
beforeEach(() => { vi.clearAllMocks(); mockedApi.tournaments.mockResolvedValue({ data: [tournament(1, "2099-01-01T10:00:00Z", "2099-01-01T12:00:00Z"), tournament(2, "2020-01-01T10:00:00Z", "2020-01-01T12:00:00Z")], meta: { page: 1, per_page: 100, total: 2, total_pages: 1 } }); });
describe("MyTournaments", () => { it("uses server-side mine filtering via TournamentList", async () => { render(<MemoryRouter><MyTournaments /></MemoryRouter>); expect(await screen.findByText("Tournament 1")).toBeInTheDocument(); await waitFor(() => expect(mockedApi.tournaments).toHaveBeenCalledWith(expect.objectContaining({ mine: true }), expect.anything())); }); });