import { describe, expect, it } from "vitest";
import type { TrainingSession } from "../api";
import { formatWeekRange, sessionsByWeek } from "./training";

const session = (
  id: number,
  startsAt: string,
  overrides: Partial<TrainingSession> = {},
): TrainingSession =>
  ({
    id,
    title: `Session ${id}`,
    description: null,
    starts_at: startsAt,
    ends_at: startsAt,
    location: null,
    status: "scheduled",
    visibility: "shared",
    created_by_id: null,
    ...overrides,
  }) as TrainingSession;

/** Local date-time string (no zone suffix) so the helpers see local wall-clock time. */
const local = (year: number, month: number, day: number, hour = 9) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;

describe("formatWeekRange", () => {
  it("formats a week inside a single year without the year", () => {
    // 2026-09-07 is a Monday, 2026-09-13 the Sunday of the same week.
    expect(formatWeekRange(new Date(2026, 8, 7), new Date(2026, 8, 13))).toBe(
      "Week from Sep 7 to Sep 13",
    );
  });

  it("shows the year on both ends when the week spans a year boundary", () => {
    expect(formatWeekRange(new Date(2025, 11, 29), new Date(2026, 0, 4))).toBe(
      "Week from Dec 29, 2025 to Jan 4, 2026",
    );
  });
});

describe("sessionsByWeek", () => {
  it("returns no groups for an empty list", () => {
    expect(sessionsByWeek([])).toEqual([]);
  });

  it("groups sessions into Monday–Sunday weeks", () => {
    // Mon 2026-09-07, Sat 2026-09-12 and Sun 2026-09-13 belong to the same
    // Mon–Sun week; Mon 2026-09-14 starts the next one.
    const groups = sessionsByWeek([
      session(1, local(2026, 9, 7)),
      session(2, local(2026, 9, 12)),
      session(3, local(2026, 9, 13)),
      session(4, local(2026, 9, 14)),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2026-09-07");
    expect(groups[0].sessions.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(groups[1].key).toBe("2026-09-14");
    expect(groups[1].sessions.map((s) => s.id)).toEqual([4]);
  });

  it("puts a Sunday session in the week that started on the previous Monday", () => {
    const groups = sessionsByWeek([session(1, local(2026, 9, 13))]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-09-07");
    expect(groups[0].label).toBe("Week from Sep 7 to Sep 13");
  });

  it("keeps several sessions of the same week together, ordered by start time", () => {
    const groups = sessionsByWeek([
      session(1, local(2026, 9, 9, 18)),
      session(2, local(2026, 9, 8, 9)),
      session(3, local(2026, 9, 10, 12)),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map((s) => s.id)).toEqual([2, 1, 3]);
  });

  it("returns weeks oldest first and labels each one", () => {
    const groups = sessionsByWeek([
      session(1, local(2026, 9, 21)),
      session(2, local(2026, 9, 7)),
      session(3, local(2026, 9, 14)),
    ]);

    expect(groups.map((g) => g.key)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Week from Sep 7 to Sep 13",
      "Week from Sep 14 to Sep 20",
      "Week from Sep 21 to Sep 27",
    ]);
  });

  it("omits weeks without sessions", () => {
    const groups = sessionsByWeek([
      session(1, local(2026, 9, 7)),
      session(2, local(2026, 9, 21)),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.key)).not.toContain("2026-09-14");
  });

  it("exposes the week start and end dates", () => {
    const [group] = sessionsByWeek([session(1, local(2026, 9, 9))]);

    expect(group.start.getDay()).toBe(1);
    expect(group.end.getDay()).toBe(0);
    expect(group.start.getDate()).toBe(7);
    expect(group.end.getDate()).toBe(13);
  });
});