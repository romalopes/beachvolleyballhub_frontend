import { describe, expect, it } from "vitest";
import type { TrainingSeries, TrainingSession } from "../api";
import {
  addWeeksIso,
  seriesOverrides,
  seriesScheduleLabel,
  summariseSelection,
  toggleWeekday,
  weekdaysLabel,
} from "./recurringTraining";

const series = (overrides: Partial<TrainingSeries> = {}): TrainingSeries =>
  ({
    id: 1,
    training_template_id: 2,
    organisation_id: null,
    created_by_id: null,
    frequency: "weekly",
    interval: 1,
    weekdays: ["mon", "wed"],
    starts_on: "2026-11-02",
    ends_on: "2026-11-29",
    local_start_time: "07:00",
    duration_minutes: 90,
    time_zone: "Australia/Sydney",
    status: "active",
    generated_through: null,
    last_generated_at: null,
    stopped_at: null,
    stopped_reason: null,
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    defaults: {},
    next_generation_start: "2026-11-02",
    completed: false,
    ...overrides,
  });

const session = (overrides: Partial<TrainingSession> = {}): TrainingSession =>
  ({
    id: 1,
    title: "Session",
    description: null,
    starts_at: "2026-11-02T07:00:00+11:00",
    ends_at: "2026-11-02T08:30:00+11:00",
    location: null,
    status: "scheduled",
    visibility: "shared",
    created_by_id: null,
    ...overrides,
  });

describe("recurringTraining utils", () => {
  it("labels weekdays in canonical order", () => {
    expect(weekdaysLabel(["wed", "mon"])).toBe("Mon & Wed");
    expect(weekdaysLabel(["fri", "mon", "wed"])).toBe("Mon, Wed & Fri");
    expect(weekdaysLabel([])).toBe("No weekdays selected");
  });

  it("toggles weekdays without duplicates or reordering", () => {
    expect(toggleWeekday(["mon", "wed"], "wed")).toEqual(["mon"]);
    expect(toggleWeekday(["mon"], "fri")).toEqual(["mon", "fri"]);
    expect(toggleWeekday(["wed", "mon"], "mon")).toEqual(["wed"]);
  });

  it("adds weeks without a UTC shift", () => {
    expect(addWeeksIso("2026-11-02", 2)).toBe("2026-11-16");
  });

  it("builds only the overrides the coach supplied", () => {
    expect(
      seriesOverrides({
        title: "  Sunrise Skills ",
        location: " Coogee Beach ",
        capacity: "16",
        level: " ",
      }),
    ).toEqual({
      title: "Sunrise Skills",
      location: "Coogee Beach",
      capacity: 16,
    });

    expect(seriesOverrides({ capacity: "0" })).toEqual({});
  });

  it("describes the weekly schedule", () => {
    expect(seriesScheduleLabel(series())).toBe(
      "Weekly on Mon & Wed at 07:00 (Australia/Sydney)",
    );
    expect(seriesScheduleLabel(series({ interval: 2 }))).toBe(
      "Every 2 weeks on Mon & Wed at 07:00 (Australia/Sydney)",
    );
  });

  it("summarises selection eligibility", () => {
    const sessions = [
      session({ id: 1 }),
      session({ id: 2, status: "cancelled", cancellable: false }),
      session({ id: 3, status: "draft", deletable: true }),
    ];

    expect(summariseSelection(sessions, new Set([1, 2, 3]))).toEqual({
      selectedCount: 3,
      cancellableCount: 2,
      deletableCount: 1,
    });
  });
});
