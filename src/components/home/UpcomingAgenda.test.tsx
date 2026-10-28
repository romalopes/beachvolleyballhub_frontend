import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Tournament, TrainingSession } from "../../api";
import UpcomingAgenda from "./UpcomingAgenda";

const CURSOR = new Date(2026, 9, 28, 12);

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
  timezone: "UTC",
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
        cursor={CURSOR}
        range="month"
        onPrevious={vi.fn()}
        onToday={vi.fn()}
        onNext={vi.fn()}
        onRangeChange={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("UpcomingAgenda", () => {
  it("renders the month grid and mixes events chronologically by day", () => {
    renderAgenda({
      trainingSessions: [training()],
      tournaments: [tournament()],
    });

    const calendar = screen.getByLabelText(
      "Sep 27 – Nov 7, 2026 training and tournament calendar",
    );
    expect(within(calendar).getAllByRole("region")).toHaveLength(42);

    const day = within(calendar)
      .getByText("Sydney Sand Series")
      .closest<HTMLElement>(".calendar-day");
    expect(day).not.toBeNull();
    const links = within(day!).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Sydney Sand Series");
    expect(links[1]).toHaveTextContent("Morning passing");
    expect(links[0]).toHaveAttribute("href", "/tournaments/2");
    expect(links[1]).toHaveAttribute("href", "/training/1");
  });

  it("renders a seven-day week and invokes the controlled navigation callbacks", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onToday = vi.fn();
    const onNext = vi.fn();
    const onRangeChange = vi.fn();

    renderAgenda({
      range: "week",
      onPrevious,
      onToday,
      onNext,
      onRangeChange,
    });

    const calendar = screen.getByLabelText(
      "Oct 25 – Oct 31, 2026 training and tournament calendar",
    );
    expect(within(calendar).getAllByRole("region")).toHaveLength(7);
    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Previous period" }));
    await user.click(screen.getByRole("button", { name: "Today" }));
    await user.click(screen.getByRole("button", { name: "Next period" }));
    await user.click(screen.getByRole("tab", { name: "Month" }));

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onRangeChange).toHaveBeenCalledWith("month");
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

  it("shows every event in the visible range and excludes events outside it", () => {
    const visibleTraining = Array.from({ length: 7 }, (_, index) =>
      training({
        id: index + 1,
        title: `Training ${index + 1}`,
        starts_at: `2026-11-${String(index + 1).padStart(2, "0")}T08:00:00Z`,
      }),
    );

    renderAgenda({
      trainingSessions: [
        ...visibleTraining,
        training({ id: 20, title: "Outside range", starts_at: "2026-12-06T08:00:00Z" }),
      ],
      tournaments: [tournament({ id: 30, name: "Visible tournament" })],
    });

    expect(document.querySelectorAll(".home-agenda-item")).toHaveLength(8);
    expect(screen.getByText("Training 7")).toBeInTheDocument();
    expect(screen.getByText("Visible tournament")).toBeInTheDocument();
    expect(screen.queryByText("Outside range")).not.toBeInTheDocument();
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
        <UpcomingAgenda
          trainingSessions={[]}
          tournaments={[]}
          loading={false}
          error="boom"
          cursor={CURSOR}
          range="month"
          onPrevious={vi.fn()}
          onToday={vi.fn()}
          onNext={vi.fn()}
          onRangeChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");

    rerender(
      <MemoryRouter>
        <UpcomingAgenda
          trainingSessions={[]}
          tournaments={[]}
          loading={false}
          error={null}
          cursor={CURSOR}
          range="month"
          onPrevious={vi.fn()}
          onToday={vi.fn()}
          onNext={vi.fn()}
          onRangeChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/No training sessions or tournaments are scheduled/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/training and tournament calendar/)).toBeInTheDocument();
  });

  it("renders the location filter off by default and reports the change", async () => {
    const user = userEvent.setup();
    const onLocalEventRadiusChange = vi.fn();

    renderAgenda({ localEventRadius: "all", onLocalEventRadiusChange });

    const toggle = screen.getByRole("checkbox", { name: "Within 25 km" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(onLocalEventRadiusChange).toHaveBeenCalledWith("25km");
  });

  it("shows the location filter as active when the radius is limited", () => {
    renderAgenda({ localEventRadius: "25km" });

    expect(screen.getByRole("checkbox", { name: "Within 25 km" })).toBeChecked();
  });
});