import { describe, expect, it, vi } from "vitest";
import type { Player, TrainingSessionParticipant } from "../../api";
import {
  includesPerson,
  includesPlayer,
  participantDraftsFromSession,
  participantFromGroupMember,
  participantFromPerson,
  participantFromPlayer,
  playerSubtitle,
} from "./participantDraft";

vi.spyOn(Date, "now").mockReturnValue(1_000);

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 9,
  person_id: 20,
  preferred_position: "Setter",
  level: "Intermediate",
  status: "active",
  visibility: "shared",
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  full_name: "  Bea Smith  ",
  person: null,
  ...overrides,
});

describe("participant drafts", () => {
  it("formats player subtitles and creates existing-player rows", () => {
    expect(playerSubtitle(player())).toBe("Setter · Intermediate");
    expect(playerSubtitle({ preferred_position: " ", level: null })).toBeNull();

    const draft = participantFromPlayer(player(), "confirmed");
    expect(draft).toMatchObject({
      player_profile_id: 9,
      status: "confirmed",
      name: "Bea Smith",
      subtitle: "Setter · Intermediate",
      isNewPerson: false,
    });
    expect(draft.key).toMatch(/^participant-1000-/);
  });

  it("falls back to person names and creates inline people", () => {
    const existing = participantFromPlayer(
      player({ full_name: " ", person: { id: 20, first_name: "Kai", last_name: "Lee", email: null, phone: null, date_of_birth: null, creation_source: "test" } }),
    );
    expect(existing.name).toBe("Kai Lee");

    const inline = participantFromPerson({ first_name: "Ana", last_name: "Diaz" });
    expect(inline).toMatchObject({
      person: { first_name: "Ana", last_name: "Diaz" },
      status: "invited",
      name: "Ana Diaz",
      subtitle: "New player — no account yet",
      isNewPerson: true,
    });
  });

  it("rebuilds persisted rows without losing ids, notes, or fallbacks", () => {
    const rows: TrainingSessionParticipant[] = [
      {
        id: 3,
        player_profile_id: 9,
        status: "attended",
        notes: null,
        player_name: " ",
        player_profile: {
          id: 9,
          preferred_position: "Blocker",
          level: null,
          person: { id: 20, first_name: "Jo", last_name: "Ng", email: null, phone: null },
        },
      },
      { id: 4, player_profile_id: 10, status: "invited", notes: "Late" },
    ];

    expect(participantDraftsFromSession(rows)).toEqual([
      expect.objectContaining({ id: 3, name: "Jo Ng", notes: "", subtitle: "Blocker" }),
      expect.objectContaining({ id: 4, name: "Player #10", notes: "Late", subtitle: null }),
    ]);
    expect(participantDraftsFromSession(undefined)).toEqual([]);
  });

  it("detects duplicate profiles and nested people", () => {
    const draft = participantFromPlayer(player());
    expect(includesPlayer([draft], 9)).toBe(true);
    expect(includesPlayer([draft], 10)).toBe(false);

    const withPerson = Object.assign(draft, {
      player_profile: { person: { id: 20 } },
    });
    expect(includesPerson([withPerson], 20)).toBe(true);
    expect(includesPerson([draft], 21)).toBe(false);
  });

  it("creates group-member rows for profiles and inline people", () => {
    const existing = participantFromGroupMember({
      person_id: 20,
      player_profile_id: 9,
      name: " Bea Smith ",
      level: "Advanced",
      preferred_position: "Setter",
      email: "bea@example.com",
      role: "member",
    });
    expect(existing).toMatchObject({
      player_profile_id: 9,
      name: "Bea Smith",
      subtitle: "Setter Advanced",
      isNewPerson: false,
    });

    const inline = participantFromGroupMember({
      person_id: 21,
      player_profile_id: null,
      name: "Ana Maria Diaz",
      level: null,
      preferred_position: null,
      email: "ana@example.com",
      role: "guest",
    });
    expect(inline).toMatchObject({
      person: {
        first_name: "Ana",
        last_name: "Maria Diaz",
        email: "ana@example.com",
      },
      name: "Ana Maria Diaz",
      subtitle: "Group member (guest) — no account yet",
      isNewPerson: true,
    });
  });
});