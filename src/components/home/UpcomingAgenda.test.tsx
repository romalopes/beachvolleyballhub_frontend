import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Tournament, TrainingSession } from "../../api";
import UpcomingAgenda from "./UpcomingAgenda";

const training = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 1,
  title: "Morning passing",
  description: null,
  starts_at: "2026-11-02T08:00:00Z",
  ends_at: "2026-11-02T09:30:00Z",
  location: "Coogee Beach",
  location_detail: "Court 2",
  status: "scheduled",
  visibility: "shared",
  created_by_id: 1,
  ...overrides,
});

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 2,
  name: "Sydney Sand Series",
  organisation: { id: 1, name: "Beach Club", acronym: "BC" } as Tournament["organisation"],
  scope: "club",
  division_scheme: "letter",
  publication_state: "active",
  website_url: null,
  description: null,
  location_name: "Maroubra Beach",
  timezone: "Australia/Sydney",
  all_day: false,
  starts_at: "2026-11-02T06:00:00Z",
  ends_at: "2026-11-02T10:00:00Z",
  created_by_account_id: 1,
  divisions: [],
  participations: [],
  watch_links: [],
  ...overrides,
});

function renderAgenda(
  props: Partial<ComponentProps<typeof UpcomingAgenda>> = {},
) {
  return render(
    <MemoryRouter>
      <UpcomingAgenda
        trainingSessions={[]}
        tournaments={[]}
        loading={false}
        error={null}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("UpcomingAgenda", () => {
  it("mixes events chronologically and groups them by date", () => {
    renderAgenda({
      trainingSessions: [training()],
      tournaments: [tournament()],
    });

    const group = screen.getByRole("heading", { name: "Monday, November 2" })
      .closest<HTMLElement>(".home-agenda-group");
    expect(group).not.toBeNull();
    const links = within(group!).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Sydney Sand Series");
    expect(links[1]).toHaveTextContent("Morning passing");
    expect(links[0]).toHaveAttribute("href", "/tournaments/2");
    expect(links[1]).toHaveAttribute("href", "/training/1");
  });

  it("shows compact event details and optional training labels", () => {
    renderAgenda({
      trainingSessions: [
        training({ visibility: "private", training_series_id: 9 }),
      ],
      tournaments: [tournament({ all_day: true })],
    });

    expect(screen.getByText("Training · Private · Recurring")).toBeInTheDocument();
    expect(screen.getByText("Coogee Beach · Court 2")).toBeInTheDocument();
    expect(screen.getByText("All day")).toBeInTheDocument();
    expect(screen.getByText("Maroubra Beach")).toBeInTheDocument();
  });

  it("limits the combined chronological agenda and links to the full calendars", () => {
    renderAgenda({
      maxItems: 3,
      trainingSessions: [
        training({ id: 1, title: "Second event", starts_at: "2026-11-02T08:00:00Z" }),
        training({ id: 2, title: "Fourth event", starts_at: "2026-11-04T08:00:00Z" }),
      ],
      tournaments: [
        tournament({ id: 3, name: "First event", starts_at: "2026-11-01T06:00:00Z" }),
        tournament({ id: 4, name: "Third event", starts_at: "2026-11-03T06:00:00Z" }),
      ],
    });

    const eventLinks = document.querySelectorAll(".home-agenda-item");
    expect(eventLinks).toHaveLength(3);
    expect([...eventLinks].map((link) => link.textContent)).toEqual([
      expect.stringContaining("First event"),
      expect.stringContaining("Second event"),
      expect.stringContaining("Third event"),
    ]);
    expect(screen.queryByText("Fourth event")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all training" })).toHaveAttribute(
      "href",
      "/training?view=calendar",
    );
    expect(screen.getByRole("link", { name: "View all tournaments" })).toHaveAttribute(
      "href",
      "/tournaments",
    );
  });

  it("renders loading, error, and empty states", () => {
    const { rerender } = renderAgenda({ loading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading upcoming events");

    rerender(
      <MemoryRouter>
        <UpcomingAgenda trainingSessions={[]} tournaments={[]} loading={false} error="boom" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");

    rerender(
      <MemoryRouter>
        <UpcomingAgenda trainingSessions={[]} tournaments={[]} loading={false} error={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No upcoming training sessions or tournaments/)).toBeInTheDocument();
  });
});