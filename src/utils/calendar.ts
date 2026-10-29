export {};

// --- calendar grid helpers (pure date math, no timezone shifts) ---

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Start of the calendar week (Sunday) containing `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

/**
 * Start of the ISO week (Monday) containing `date`, at local midnight.
 * Used by the training list view, which groups sessions into Mon–Sun weeks.
 * The calendar grid keeps the Sunday-based `startOfWeek` above.
 */
export function startOfIsoWeek(date: Date): Date {
  const start = startOfDay(date);
  return addDays(start, -((start.getDay() + 6) % 7));
}

/**
 * All cells for a month grid: full weeks covering the month, starting Sunday.
 * Always a multiple of 7 starting on a Sunday.
 */
export function monthGridDays(cursor: Date): Date[] {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const endExclusive = addDays(startOfWeek(addDays(lastOfMonth, 1)), 7);
  const days: Date[] = [];
  for (let day = start; day < endExclusive; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/**
 * Monday-starting full-week range covering a month, with an exclusive end.
 * October 2026, for example, returns Sep 28 through Nov 2 (exclusive), so a
 * grouped list starts with the week in which October begins.
 */
export function monthIsoWeekRange(cursor: Date): {
  start: Date;
  endExclusive: Date;
} {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return {
    start: startOfIsoWeek(firstOfMonth),
    endExclusive: addDays(startOfIsoWeek(lastOfMonth), 7),
  };
}

/** The 7 days (Sunday–Saturday) of the week containing `cursor`. */
export function weekGridDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** ISO date sent to the API date-range filter (local wall-clock date). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Heading for a week: "Week from Sep 7 to Sep 13". A week that spans a year
 * boundary shows the year on both ends, e.g. "Week from Dec 29, 2025 to
 * Jan 4, 2026".
 */
export function formatWeekRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endText = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `Week from ${startText} to ${endText}`;
}
