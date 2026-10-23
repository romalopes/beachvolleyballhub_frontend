import { describe, expect, it, vi } from "vitest";
import type { Tournament } from "../api";
import {
  fetchAllTournamentPages,
  filtersFromSearchParams,
  tournamentDayKeys,
  tournamentRelationship,
  tournamentSearchParams,
  tournamentsByDay,
  tournamentsByWeek,
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

  it("round-trips relationship filters through the URL", () => {
    const params = tournamentSearchParams({ relationship: ["created", "following"] }, "list", new Date(2026, 2, 1));
    expect(params.get("relationship")).toBe("created,following");
    expect(params.get("mine")).toBeNull();
    expect(filtersFromSearchParams(params)).toEqual({ relationship: ["created", "following"] });
  });

  it("maps the legacy mine=1 bookmark to participating and never emits both", () => {
    expect(filtersFromSearchParams(new URLSearchParams("mine=1"))).toEqual({ mine: true });
    // A relationship filter supersedes the legacy bookmark when both appear.
    expect(filtersFromSearchParams(new URLSearchParams("mine=1&relationship=created")))
      .toEqual({ relationship: ["created"] });
    expect(tournamentSearchParams({ mine: true }, "calendar", new Date(2026, 2, 1)).get("mine")).toBe("1");
  });

  it("ignores unknown relationship kinds from the URL", () => {
    expect(filtersFromSearchParams(new URLSearchParams("relationship=created,removed")))
      .toEqual({ relationship: ["created"] });
  });

  it("reports the caller's strongest tie, and none for a guest without ties", () => {
    const accountId = 7;
    expect(tournamentRelationship(tournament({ created_by_account_id: 7 }), accountId)).toBe("created");
    expect(
      tournamentRelationship(
        tournament({ created_by_account_id: 1, my_participation: { id: 2, account_id: accountId, role: "player", created_at: "2026-01-01T00:00:00Z", division_ids: [] } }),
        accountId,
      ),
    ).toBe("participating");
    expect(tournamentRelationship(tournament({ my_following: true }), accountId)).toBe("following");
    expect(tournamentRelationship(tournament(), accountId)).toBeNull();
    // The payload flags only exist for signed-in callers, but a flag alone
    // still carries the tie (the account match is only needed for "created").
    expect(tournamentRelationship(tournament({ my_following: true }), undefined)).toBe("following");
  });
});

describe("tournamentsByWeek", () => {
  it("returns no groups for an empty list", () => {
    expect(tournamentsByWeek([])).toEqual([]);
  });

  it("groups tournaments into Monday-Sunday weeks of their local start date", () => {
    // Mon 2026-10-05, Sun 2026-10-11 and Mon 2026-10-12.
    const groups = tournamentsByWeek([
      tournament({ id: 1, starts_at: "2026-10-05T15:00:00Z" }),
      tournament({ id: 2, starts_at: "2026-10-11T15:00:00Z" }),
      tournament({ id: 3, starts_at: "2026-10-12T15:00:00Z" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2026-10-05");
    expect(groups[0].tournaments.map(({ id }) => id)).toEqual([1, 2]);
    expect(groups[1].key).toBe("2026-10-12");
    expect(groups[1].tournaments.map(({ id }) => id)).toEqual([3]);
  });

  it("places a multi-day tournament in the week of its start date", () => {
    const groups = tournamentsByWeek([
      tournament({ id: 1, starts_at: "2026-10-09T15:00:00Z", ends_at: "2026-10-11T16:00:00Z" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-10-05");
  });

  it("uses the tournament timezone to decide the week", () => {
    // 2026-10-05T02:00:00Z is still Oct 4 in New York, so it belongs to the
    // week starting Monday 2026-09-28.
    const groups = tournamentsByWeek([
      tournament({ id: 1, starts_at: "2026-10-05T02:00:00Z", timezone: "America/New_York" }),
    ]);

    expect(groups[0].key).toBe("2026-09-28");
  });

  it("labels each week and exposes its Monday and Sunday", () => {
    const [group] = tournamentsByWeek([
      tournament({ id: 1, starts_at: "2026-10-07T15:00:00Z" }),
    ]);

    expect(group.start.getDay()).toBe(1);
    expect(group.end.getDay()).toBe(0);
    expect(group.label).toBe("Week from Oct 5 to Oct 11");
  });

  it("returns weeks oldest first with tournaments ordered by start time", () => {
    const groups = tournamentsByWeek([
      tournament({ id: 1, starts_at: "2026-10-19T15:00:00Z" }),
      tournament({ id: 2, starts_at: "2026-10-06T15:00:00Z" }),
      tournament({ id: 3, starts_at: "2026-10-08T15:00:00Z" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-10-05", "2026-10-19"]);
    expect(groups[0].tournaments.map(({ id }) => id)).toEqual([2, 3]);
  });
});
