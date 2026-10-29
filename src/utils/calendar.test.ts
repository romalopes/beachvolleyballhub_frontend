import { describe, expect, it } from "vitest";
import { monthIsoWeekRange, toISODate } from "./calendar";

describe("monthIsoWeekRange", () => {
  it("covers October 2026 with complete Monday-Sunday weeks", () => {
    const range = monthIsoWeekRange(new Date(2026, 9, 15));

    expect(toISODate(range.start)).toBe("2026-09-28");
    expect(toISODate(range.endExclusive)).toBe("2026-11-02");
  });

  it("extends through the last containing week when a month ends on Monday", () => {
    const range = monthIsoWeekRange(new Date(2026, 10, 15));

    expect(toISODate(range.start)).toBe("2026-10-26");
    expect(toISODate(range.endExclusive)).toBe("2026-12-07");
  });
});