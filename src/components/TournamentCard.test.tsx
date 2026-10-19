import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tournament } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import TournamentCard from "./TournamentCard";

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
  timezone: "UTC",
  all_day: false,
  starts_at: "2026-03-07T15:00:00Z",
  ends_at: "2026-03-07T17:00:00Z",
  created_by_account_id: 1,
  divisions: [],
  participations: [],
  watch_links: [],
  ...overrides,
});

const auth = (account_id: number | null): AuthContextValue => ({
  user:
    account_id === null
      ? null
      : {
          id: 1,
          name: "User",
          email_address: "user@example.com",
          roles: ["player"],
          account_id,
        },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
});

function renderCard(t: Tournament, accountId: number | null) {
  return render(
    <AuthContext.Provider value={auth(accountId)}>
      <TournamentCard tournament={t} />
    </AuthContext.Provider>,
  );
}

describe("TournamentCard", () => {
  it("badges and stripes a tournament the account created", () => {
    renderCard(tournament({ created_by_account_id: 7 }), 7);
    expect(screen.getByText("Created by you")).toBeInTheDocument();
    expect(document.querySelector(".tournament-card--created")).not.toBeNull();
  });

  it("badges a tournament the account participates in without claiming creation", () => {
    renderCard(
      tournament({
        created_by_account_id: 1,
        my_participation: { id: 2, account_id: 7, role: "player", created_at: "2026-01-01T00:00:00Z", division_ids: [] },
      }),
      7,
    );
    expect(screen.getByText("Participating")).toBeInTheDocument();
    expect(screen.queryByText("Created by you")).not.toBeInTheDocument();
    expect(document.querySelector(".tournament-card--participating")).not.toBeNull();
  });

  it("badges a tournament the account only follows", () => {
    renderCard(tournament({ my_following: true }), 7);
    expect(screen.getByText("Following")).toBeInTheDocument();
    expect(document.querySelector(".tournament-card--following")).not.toBeNull();
  });

  it("marks nothing on a card the signed-in guest has no tie to", () => {
    renderCard(tournament(), 7);
    expect(screen.queryByText(/Created by you|Participating|Following/)).not.toBeInTheDocument();
    expect(document.querySelector("[class*='tournament-card--']")).toBeNull();
  });
});