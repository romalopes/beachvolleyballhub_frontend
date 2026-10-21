import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type TrainingSession } from "../api";
import Training from "./Training";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { me: vi.fn(), trainingSessions: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);
const playerUser = { id: 1, name: "Player", email_address: "p@x.com", roles: ["player"] };
const coachUser = { id: 2, name: "Coach", email_address: "c@x.com", roles: ["coach"] };

function isoOnToday(hour: number, minute = 0): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString();
}

const session = (overrides: Partial<TrainingSession> = {}): TrainingSession =>
  ({
    id: 1,
    title: "Morning Session",
    description: null,
    starts_at: isoOnToday(9),
    ends_at: isoOnToday(11),
    location: "Coogee Beach",
    location_detail: "Court 1",
    status: "scheduled",
    visibility: "shared",
    created_by_id: null,
    status_label: "Scheduled",
    duration_minutes: 120,
    ...overrides,
  }) as TrainingSession;

const renderPage = (entry = "/training") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/training" element={<Training />} />
          <Route path="/training/:id" element={<div>Training detail page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(playerUser);
  mockedApi.trainingSessions.mockResolvedValue([
    session({}),
    session({ id: 2, title: "Cancelled Session", status: "cancelled", status_label: "Cancelled" }),
  ]);
});

afterEach(cleanup);

describe("Training page", () => {
  it("shows the list view by default with tournament-style cards", async () => {
    renderPage();

    expect(await screen.findByText("Morning Session")).toBeInTheDocument();
    expect(screen.getByText("Cancelled Session")).toBeInTheDocument();
    expect(screen.getAllByText("Coogee Beach · Court 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector(".training-cards-grid")).not.toBeNull();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.not.objectContaining({ starts_at_from: expect.any(String) }),
    );
  });

  it("switches to the calendar view and back to the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Morning Session");

    await user.click(screen.getByRole("tab", { name: /calendar/i }));

    const calendar = document.querySelector(".training-calendar-month");
    expect(calendar).not.toBeNull();
    expect(within(calendar as HTMLElement).getByText("Morning Session")).toBeInTheDocument();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.objectContaining({ starts_at_from: expect.any(String), starts_at_to: expect.any(String) }),
    );

    await user.click(screen.getByRole("tab", { name: /^list$/i }));
    expect(document.querySelector(".training-cards-grid")).not.toBeNull();
  });

  it("opens the training detail page from a calendar event", async () => {
    const user = userEvent.setup();
    renderPage("/training?view=calendar");

    await user.click(await screen.findByText("Morning Session"));
    expect(await screen.findByText("Training detail page")).toBeInTheDocument();
  });

  it("toggles the calendar between month and week ranges", async () => {
    const user = userEvent.setup();
    renderPage("/training?view=calendar");
    await screen.findByText("Morning Session");

    await user.click(screen.getByRole("tab", { name: "Week" }));

    expect(screen.getByText(/Week of /)).toBeInTheDocument();
    const calendar = document.querySelector(".training-calendar-week");
    expect(calendar).not.toBeNull();
    expect(within(calendar as HTMLElement).getByText("Morning Session")).toBeInTheDocument();
  });

  it("shows New Training only to managers", async () => {
    renderPage();
    await screen.findByText("Morning Session");
    expect(screen.queryByRole("button", { name: /new training/i })).not.toBeInTheDocument();
    cleanup();

    mockedApi.me.mockResolvedValue(coachUser);
    renderPage();
    await screen.findByText("Morning Session");
    expect(screen.getByRole("button", { name: /new training/i })).toBeInTheDocument();
  });

  it("filters by status through the URL-driven filter form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Morning Session");

    await user.selectOptions(screen.getByLabelText("Status"), "scheduled");

    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled" }),
    );
  });
});
