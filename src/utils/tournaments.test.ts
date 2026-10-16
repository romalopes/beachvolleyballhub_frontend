import { describe, expect, it, vi } from "vitest";
import type { Tournament } from "../api";
import {
  fetchAllTournamentPages,
  filtersFromSearchParams,
  tournamentDayKeys,
  tournamentSearchParams,
  tournamentsByDay,
} from "./tournaments";

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 1,
  name: "Sand Series",
  organisation: { id: 3, name: "Beach Club", acronym: "BC" } as Tournament["organisation"],
  scope: "club",
  division_scheme: "letter",
  publication_state: "active",
  website_url: null,
  description: null,
  location_name: null,
  city: null,
  state: null,
  country: null,
  timezone: "America/New_York",
  all_day: false,
  starts_at: "2026-03-07T15:00:00Z",
  ends_at: "2026-03-07T17:00:00Z",
  created_by_account_id: 1,
  divisions: [],
  participations: [],
  watch_links: [],
  ...overrides,
});

describe("tournament directory helpers", () => {
  it("serializes URL-safe filters and restores them", () => {
    const params = tournamentSearchParams({ search: "sand", mine: true, organisation_ids: ["3", "8"], letter_levels: ["A", "AA"] }, "list", new Date(2026, 2, 1));
    expect(params.toString()).toBe("search=sand&organisation_ids=3%2C8&letter_levels=A%2CAA&mine=1&view=list&month=2026-03");
    expect(filtersFromSearchParams(params)).toEqual({ search: "sand", mine: true, organisation_ids: ["3", "8"], letter_levels: ["A", "AA"] });
  });

  it("loads every page when a bounded calendar result exceeds 100 tournaments", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, id) => tournament({ id: id + 1 })), meta: { page: 1, per_page: 100, total: 101, total_pages: 2 } })
      .mockResolvedValueOnce({ data: [tournament({ id: 101 })], meta: { page: 2, per_page: 100, total: 101, total_pages: 2 } });

    await expect(fetchAllTournamentPages({ search: "sand" }, undefined, fetchPage)).resolves.toHaveLength(101);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { search: "sand", page: 1, per_page: 100 }, { signal: undefined });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { search: "sand", page: 2, per_page: 100 }, { signal: undefined });
  });

  it("places multi-day and overlapping tournaments on every local calendar day", () => {
    const multiDay = tournament({ id: 1, starts_at: "2026-03-07T15:00:00Z", ends_at: "2026-03-09T16:00:00Z" });
    const overlap = tournament({ id: 2, starts_at: "2026-03-08T16:00:00Z", ends_at: "2026-03-08T18:00:00Z" });
    expect(tournamentDayKeys(multiDay)).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
    expect(tournamentsByDay([multiDay, overlap]).get("2026-03-08")?.map(({ id }) => id)).toEqual([1, 2]);
  });

  it("uses the tournament timezone across a DST boundary", () => {
    const dstTournament = tournament({ starts_at: "2026-03-08T04:30:00Z", ends_at: "2026-03-09T03:30:00Z" });
    expect(tournamentDayKeys(dstTournament)).toEqual(["2026-03-07", "2026-03-08"]);
  });
});