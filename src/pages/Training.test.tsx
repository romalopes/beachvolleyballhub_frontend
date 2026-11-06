import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type TrainingSeries, type TrainingSession } from "../api";
import Training from "./Training";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { me: vi.fn(), trainingSessions: vi.fn(), trainingSeriesList: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);
const playerUser = { id: 1, name: "Player", email_address: "p@x.com", roles: ["player"] };
const coachUser = { id: 2, name: "Coach", email_address: "c@x.com", roles: ["coach"] };

function isoOnToday(hour: number, minute = 0): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString();
}

/**
 * Local wall-clock date-time as an ISO string. The week helpers read the
 * session start in local time, so the fixture must be built in local time too.
 */
function localAt(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour).toISOString();
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

const series = (
  id: number,
  templateName: string,
  status: "active" | "stopped" = "active",
): TrainingSeries =>
  ({
    id,
    training_template_id: 1,
    status,
    training_template: { id: 1, name: templateName },
  }) as TrainingSeries;

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
  mockedApi.trainingSeriesList.mockResolvedValue({
    data: [series(3, "Monday Skills"), series(4, "Beach Camp", "stopped")],
    meta: { page: 1, per_page: 100, total: 2, total_pages: 1 },
  });
});

afterEach(cleanup);

describe("Training page", () => {
  it("shows the selected month's full ISO weeks in the list view", async () => {
    renderPage("/training?cursor=2026-10-15");

    expect(await screen.findByText("Morning Session")).toBeInTheDocument();
    expect(screen.getByText("Cancelled Session")).toBeInTheDocument();
    expect(screen.getAllByText("Coogee Beach · Court 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector(".training-cards-grid")).not.toBeNull();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        starts_at_from: "2026-09-28",
        starts_at_to: "2026-11-02",
      }),
    );
  });

  it("updates the list range when navigating to another month", async () => {
    const user = userEvent.setup();
    renderPage("/training?cursor=2026-10-15");
    await screen.findByText("Morning Session");

    await user.click(screen.getByRole("button", { name: "Next month" }));

    expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        starts_at_from: "2026-10-26",
        starts_at_to: "2026-12-07",
      }),
    );
  });

  it("uses month navigation in list view even when the URL keeps a week range", async () => {
    const user = userEvent.setup();
    renderPage("/training?view=calendar&range=week&cursor=2026-10-15");
    await screen.findByText("Week of Oct 15, 2026");

    await user.click(screen.getByRole("tab", { name: "List" }));

    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        starts_at_from: "2026-09-28",
        starts_at_to: "2026-11-02",
      }),
    );
  });

  it("groups the list view into calendar weeks", async () => {
    mockedApi.trainingSessions.mockResolvedValue([
      session({ id: 1, title: "Week One Monday", starts_at: localAt(2026, 9, 7, 9) }),
      session({ id: 2, title: "Week One Sunday", starts_at: localAt(2026, 9, 13, 9) }),
      session({ id: 3, title: "Week Two Monday", starts_at: localAt(2026, 9, 14, 9) }),
    ]);

    renderPage();

    expect(await screen.findByText("Week One Monday")).toBeInTheDocument();
    expect(screen.getByText("Week from Sep 7 to Sep 13")).toBeInTheDocument();
    expect(screen.getByText("Week from Sep 14 to Sep 20")).toBeInTheDocument();

    const weeks = document.querySelectorAll(".training-week");
    expect(weeks).toHaveLength(2);

    const [firstWeek, secondWeek] = weeks;
    expect(within(firstWeek as HTMLElement).getByText("Week One Monday")).toBeInTheDocument();
    expect(within(firstWeek as HTMLElement).getByText("Week One Sunday")).toBeInTheDocument();
    expect(within(firstWeek as HTMLElement).queryByText("Week Two Monday")).toBeNull();
    expect(within(secondWeek as HTMLElement).getByText("Week Two Monday")).toBeInTheDocument();

    // One card grid per week.
    expect(document.querySelectorAll(".training-cards-grid")).toHaveLength(2);
  });

  it("shows only one heading when every session falls in the same week", async () => {
    renderPage();

    await screen.findByText("Morning Session");
    expect(document.querySelectorAll(".training-week")).toHaveLength(1);
    expect(document.querySelectorAll(".training-week-heading")).toHaveLength(1);
  });

  it("switches to the calendar view and back to the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Morning Session");

    const toolbar = document.querySelector(".training-directory-toolbar");
    expect(toolbar).not.toBeNull();
    const viewTabs = within(toolbar as HTMLElement).getByRole("tablist", {
      name: "Training view",
    });
    expect(viewTabs.querySelectorAll("svg")).toHaveLength(2);

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

  it("filters by organisation text through the filter form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Morning Session");

    await user.type(screen.getByLabelText("Organisation"), "FIVB");

    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ organisation: "FIVB" }),
      ),
    );
  });

  it("keeps the organisation search when another filter changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Morning Session");

    await user.type(screen.getByLabelText("Organisation"), "FIVB");
    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ organisation: "FIVB" }),
      ),
    );

    await user.selectOptions(screen.getByLabelText("Status"), "scheduled");

    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ organisation: "FIVB", status: "scheduled" }),
      ),
    );
  });

  it("offers the training series in the filter dropdown", async () => {
    renderPage();
    await screen.findByText("Morning Session");

    const select = screen.getByLabelText("Training series");
    expect(
      within(select).getByRole("option", { name: "Any series" }),
    ).toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Monday Skills" }),
    ).toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Beach Camp (stopped)" }),
    ).toBeInTheDocument();
  });

  it("filters by a training series from the dropdown", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Morning Session");

    await user.selectOptions(screen.getByLabelText("Training series"), "3");

    await waitFor(() =>
      expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ training_series_id: 3 }),
      ),
    );
  });

  it("reflects a linked series filter even when the series is not in the catalogue", async () => {
    renderPage("/training?training_series_id=9");
    await screen.findByText("Morning Session");

    const select = screen.getByLabelText("Training series") as HTMLSelectElement;
    expect(select.value).toBe("9");
    expect(
      within(select).getByRole("option", { name: "Series #9" }),
    ).toBeInTheDocument();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.objectContaining({ training_series_id: 9 }),
    );
  });
});
