import type {
  TrainingSeries,
  TrainingSeriesOverrides,
  TrainingSession,
  TrainingTemplate,
  TrainingWeekday,
} from "../api";

/** Weekday tokens match the API's `weekdays` array exactly (mon..sun). */
export const WEEKDAYS: { value: TrainingWeekday; label: string; short: string }[] = [
  { value: "mon", label: "Monday", short: "Mon" },
  { value: "tue", label: "Tuesday", short: "Tue" },
  { value: "wed", label: "Wednesday", short: "Wed" },
  { value: "thu", label: "Thursday", short: "Thu" },
  { value: "fri", label: "Friday", short: "Fri" },
  { value: "sat", label: "Saturday", short: "Sat" },
  { value: "sun", label: "Sunday", short: "Sun" },
];

/** Common zones offered by the recurrence form. */
export const TIME_ZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
  "UTC",
];

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney";
  } catch {
    return "Australia/Sydney";
  }
}

/** `YYYY-MM-DD` for a Date in local time (not UTC-shifted). */
export function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addWeeksIso(iso: string, weeks: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + weeks * 7);
  return toIsoDate(date);
}

/** "Mon & Wed" / "Mon, Wed & Fri" — short labels for list rows. */
export function weekdaysLabel(weekdays: string[] | null | undefined): string {
  const labels = WEEKDAYS.filter((day) => (weekdays ?? []).includes(day.value)).map(
    (day) => day.short,
  );
  if (labels.length === 0) return "No weekdays selected";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

/** "Weekly on Mon & Wed at 07:00 (Australia/Sydney)". */
export function seriesScheduleLabel(series: TrainingSeries): string {
  const recurrence =
    series.interval === 1
      ? `Weekly on ${weekdaysLabel(series.weekdays)}`
      : `Every ${series.interval} weeks on ${weekdaysLabel(series.weekdays)}`;
  return `${recurrence} at ${series.local_start_time.slice(0, 5)} (${series.time_zone})`;
}

export function seriesStatusLabel(status: TrainingSeries["status"]): string {
  return status === "stopped" ? "Stopped" : "Active";
}

export function templateStatusLabel(template: TrainingTemplate["status"]): string {
  return template === "archived" ? "Archived" : "Active";
}

/** Toggle a weekday without duplicating or reordering the canonical list. */
export function toggleWeekday(
  current: string[],
  weekday: string,
): TrainingWeekday[] {
  const next = current.includes(weekday)
    ? current.filter((day) => day !== weekday)
    : [...current, weekday];
  return WEEKDAYS.filter((day) => next.includes(day.value)).map((day) => day.value);
}

/** Only fields the coach actually changed; blank strings are omitted. */
export function seriesOverrides(input: {
  title?: string;
  location?: string;
  locationDetail?: string;
  capacity?: string;
  level?: string;
}): TrainingSeriesOverrides {
  const overrides: TrainingSeriesOverrides = {};
  if (input.title?.trim()) overrides.title = input.title.trim();
  if (input.location?.trim()) overrides.location = input.location.trim();
  if (input.locationDetail?.trim())
    overrides.location_detail = input.locationDetail.trim();
  if (input.level?.trim()) overrides.level = input.level.trim();
  const capacity = Number(input.capacity);
  if (input.capacity?.trim() && Number.isFinite(capacity) && capacity > 0) {
    overrides.capacity = capacity;
  }
  return overrides;
}

export interface OccurrenceSelectionSummary {
  selectedCount: number;
  cancellableCount: number;
  deletableCount: number;
}

export function summariseSelection(
  sessions: TrainingSession[],
  selected: Set<number>,
): OccurrenceSelectionSummary {
  const chosen = sessions.filter((session) => selected.has(session.id));
  return {
    selectedCount: chosen.length,
    cancellableCount: chosen.filter(
      (session) => session.cancellable ?? ["draft", "scheduled"].includes(session.status),
    ).length,
    deletableCount: chosen.filter((session) => session.deletable ?? false).length,
  };
}

/** Template defaults are shown under the recurrence form as a reminder. */
export function templateSummary(template: TrainingTemplate): string {
  const parts = [
    template.duration_minutes ? `${template.duration_minutes} min` : null,
    template.capacity ? `capacity ${template.capacity}` : null,
    template.location_summary || template.location || null,
    template.visibility === "private" ? "private" : null,
  ].filter(Boolean);
  return parts.join(" · ") || "No defaults recorded";
}
