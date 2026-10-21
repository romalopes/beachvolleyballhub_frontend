import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type TrainingSeries, type TrainingSession } from "../api";
import TrainingSeriesDetail from "./TrainingSeriesDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      trainingSeries: vi.fn(),
      trainingSeriesSessions: vi.fn(),
      bulkCancelTrainingSeries: vi.fn(),
      stopTrainingSeries: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const series: TrainingSeries = {
  id: 10,
  training_template_id: 1,
  organisation_id: 2,
  created_by_id: 3,
  frequency: "weekly",
  interval: 1,
  weekdays: ["mon", "wed"],
  starts_on: "2026-11-02",
  ends_on: "2026-11-29",
  local_start_time: "07:00",
  duration_minutes: 90,
  time_zone: "Australia/Sydney",
  status: "active",
  generated_through: "2026-11-29",
  last_generated_at: "2026-10-21T00:00:00Z",
  stopped_at: null,
  stopped_reason: null,
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
  defaults: { title: "Monday Skills", visibility: "shared" },
  next_generation_start: "2026-11-30",
  completed: false,
  occurrence_count: 8,
  scheduled_count: 8,
  cancelled_count: 0,
  completed_count: 0,
  draft_count: 0,
  next_occurrence_at: "2026-11-02T07:00:00+11:00",
  training_template: { id: 1, name: "Monday Skills" },
  organisation: { id: 2, name: "Sydney Beach Volleyball Club" },
  created_by: { id: 3, name: "Coach Three" },
};

const session = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 101,
  title: "Monday Skills",
  description: null,
  starts_at: "2026-11-02T07:00:00+11:00",
  ends_at: "2026-11-02T08:30:00+11:00",
  location: "Coogee Beach",
  location_detail: "Court 1",
  status: "scheduled",
  visibility: "shared",
  created_by_id: 3,
  recurrence_key: "2026-11-02T07:00",
  status_label: "Scheduled",
  cancellable: true,
  deletable: false,
  coach_profile: { id: 9, display_name: "Maria Silva" },
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/training/series/10"]}>
      <Routes>
        <Route path="/training/series/:id" element={<TrainingSeriesDetail />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.trainingSeries.mockResolvedValue(series);
  mockedApi.trainingSeriesSessions.mockResolvedValue({
    data: [session()],
    meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
  });
  mockedApi.bulkCancelTrainingSeries.mockResolvedValue({
    affected_ids: [101],
    skipped: [],
    errors: [],
  });
  mockedApi.stopTrainingSeries.mockResolvedValue({
    training_series: { ...series, status: "stopped" },
    changed: true,
  });
});

describe("TrainingSeriesDetail", () => {
  it("shows the schedule and the occurrence table", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Weekly on Mon & Wed at 07:00 (Australia/Sydney)")).toBeInTheDocument(),
    );
    expect(screen.getByText("8 scheduled · 0 cancelled · 0 completed")).toBeInTheDocument();
    expect(screen.getByText("Coogee Beach · Court 1")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
  });

  it("cancels the selected occurrence with a reason", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Maria Silva")).toBeInTheDocument());

    await user.click(screen.getByLabelText("Select occurrence 2026-11-02T07:00"));

    const panel = screen.getByText("Cancel selected occurrences", {
      selector: "summary",
    }).closest("details");
    expect(panel).not.toBeNull();
    await user.click(within(panel as HTMLElement).getByText("Cancel selected occurrences"));
    await user.type(within(panel as HTMLElement).getByLabelText("Reason"), "Storm");
    await user.click(
      within(panel as HTMLElement).getByText("Cancel selected", { selector: "button" }),
    );

    await waitFor(() =>
      expect(mockedApi.bulkCancelTrainingSeries).toHaveBeenCalledWith(10, {
        session_ids: [101],
        reason: "Storm",
        notify_participants: true,
      }),
    );
    expect(await screen.findByText("Cancelled 1 occurrence.")).toBeInTheDocument();
  });

  it("stops recurrence from the action panel", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Maria Silva")).toBeInTheDocument());

    const panel = screen.getByText("Stop recurrence", { selector: "summary" }).closest("details");
    await user.click(
      within(panel as HTMLElement).getByText("Stop recurrence", { selector: "summary" }),
    );
    await user.click(
      within(panel as HTMLElement).getByText("Stop recurrence", { selector: "button" }),
    );

    await waitFor(() =>
      expect(mockedApi.stopTrainingSeries).toHaveBeenCalledWith(10, undefined),
    );
  });
});
