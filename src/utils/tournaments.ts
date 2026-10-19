import type {
  PaginatedResponse,
  Tournament,
  TournamentFilters,
  TournamentRelationship,
} from "../api";

export type TournamentView = "calendar" | "list";

const FILTER_KEYS = [
  "search", "scope", "organisation_id", "division_scheme", "location",
  "temporal_status", "publication_state", "starts_at", "ends_at",
] as const;

const RELATIONSHIP_KINDS = ["created", "participating", "following"] as const;

function isRelationshipKind(value: string): value is TournamentRelationship {
  return (RELATIONSHIP_KINDS as readonly string[]).includes(value);
}

/**
 * The caller's strongest tie to a tournament, strongest first: a tournament
 * you created and also play in reports "created" — the other ties are implied
 * by it. Guests have no ties, so they get null.
 */
export function tournamentRelationship(
  tournament: Tournament,
  accountId: number | null | undefined,
): TournamentRelationship | null {
  if (accountId != null && tournament.created_by_account_id === accountId) return "created";
  if (tournament.my_participation) return "participating";
  if (tournament.my_following) return "following";
  return null;
}

export function filtersFromSearchParams(params: URLSearchParams): TournamentFilters {
  const filters: TournamentFilters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) Object.assign(filters, { [key]: value });
  }
  const organisationIds = params.get("organisation_ids")?.split(",").filter(Boolean);
  if (organisationIds?.length) {
    filters.organisation_ids = organisationIds;
    delete filters.organisation_id;
  }
  const letterLevels = params.get("letter_levels")?.split(",").filter(Boolean);
  if (letterLevels?.length) filters.letter_levels = letterLevels;
  const divisionNumbers = params.get("division_numbers")?.split(",").map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
  if (divisionNumbers?.length) filters.division_numbers = divisionNumbers;
  if (params.get("mine") === "1") filters.mine = true; // legacy bookmarked URLs
  const relationship = params.get("relationship")?.split(",").filter(isRelationshipKind);
  if (relationship?.length) {
    filters.relationship = relationship;
    delete filters.mine;
  }
  return filters;
}

export function tournamentSearchParams(filters: TournamentFilters, view: TournamentView, month: Date): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (key === "organisation_id" && filters.organisation_ids?.length) continue;
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  if (filters.organisation_ids?.length) params.set("organisation_ids", filters.organisation_ids.join(","));
  if (filters.letter_levels?.length) params.set("letter_levels", filters.letter_levels.join(","));
  if (filters.division_numbers?.length) params.set("division_numbers", filters.division_numbers.join(","));
  if (filters.relationship?.length) {
    params.set("relationship", filters.relationship.join(","));
  } else if (filters.mine) {
    // Only when no relationship filter supersedes it — the server reads mine=1
    // as relationship=participating, so emitting both would be redundant.
    params.set("mine", "1");
  }
  if (view === "list") params.set("view", view);
  params.set("month", monthKey(month));
  return params;
}

export function monthFromSearchParam(value: string | null, fallback = new Date()): Date {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  return new Date(year, month - 1, 1);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchAllTournamentPages(
  filters: TournamentFilters,
  signal: AbortSignal | undefined,
  fetchPage: (pageFilters: TournamentFilters, request?: { signal?: AbortSignal }) => Promise<PaginatedResponse<Tournament>>,
): Promise<Tournament[]> {
  const first = await fetchPage({ ...filters, page: 1, per_page: 100 }, { signal });
  const pages = Array.from({ length: Math.max(0, first.meta.total_pages - 1) }, (_, index) => index + 2);
  const remaining = await Promise.all(pages.map((page) => fetchPage({ ...filters, page, per_page: 100 }, { signal })));
  return [first, ...remaining].flatMap((response) => response.data);
}

function zonedDateKey(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDateKeyDay(key: string, offset: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

/** Calendar day keys in the tournament's declared timezone, inclusive at both ends. */
export function tournamentDayKeys(tournament: Tournament): string[] {
  const start = zonedDateKey(tournament.starts_at, tournament.timezone);
  const end = zonedDateKey(tournament.ends_at, tournament.timezone);
  const keys: string[] = [];
  for (let key = start; key <= end; key = addDateKeyDay(key, 1)) keys.push(key);
  return keys;
}

export function tournamentsByDay(tournaments: Tournament[]): Map<string, Tournament[]> {
  const grouped = new Map<string, Tournament[]>();
  tournaments.forEach((tournament) => tournamentDayKeys(tournament).forEach((key) => {
    const events = grouped.get(key) ?? [];
    events.push(tournament);
    grouped.set(key, events);
  }));
  return grouped;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}