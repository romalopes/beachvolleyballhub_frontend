import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type TrainingSeriesPreview, type TrainingTemplate } from "../api";
import TrainingSeriesFormPage from "./TrainingSeriesFormPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      trainingTemplates: vi.fn(),
      previewTrainingSeries: vi.fn(),
      createTrainingSeries: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const template: TrainingTemplate = {
  id: 1,
  name: "Monday Skills",
  description: "Ball control",
  organisation_id: 2,
  group_id: null,
  coach_profile_id: null,
  location: "Coogee Beach",
  location_detail: "Court 1",
  location_summary: "Coogee Beach · Court 1",
  level: "intermediate",
  capacity: 12,
  duration_minutes: 90,
  visibility: "shared",
  status: "active",
  created_by_id: 3,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const preview: TrainingSeriesPreview = {
  valid: true,
  errors: [],
  warnings: [],
  time_zone: "Australia/Sydney",
  total: 2,
  returned: 2,
  truncated: false,
  occurrences: [
    {
      recurrence_key: "2026-11-02T07:00",
      local_date: "2026-11-02",
      local_start_time: "07:00",
      starts_at: "2026-11-02T07:00:00+11:00",
      ends_at: "2026-11-02T08:30:00+11:00",
      duration_minutes: 90,
      warnings: [],
      conflicts: [],
    },
    {
      recurrence_key: "2026-11-04T07:00",
      local_date: "2026-11-04",
      local_start_time: "07:00",
      starts_at: "2026-11-04T07:00:00+11:00",
      ends_at: "2026-11-04T08:30:00+11:00",
      duration_minutes: 90,
      warnings: [],
      conflicts: [],
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/training/series/new?template_id=1"]}>
      <Routes>
        <Route path="/training/series/new" element={<TrainingSeriesFormPage />} />
        <Route path="/training/series/:id" element={<div>Series detail</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.trainingTemplates.mockResolvedValue({
    data: [template],
    meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
  });
  mockedApi.previewTrainingSeries.mockResolvedValue(preview);
  mockedApi.createTrainingSeries.mockResolvedValue({
    training_series: {
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
      last_generated_at: null,
      stopped_at: null,
      stopped_reason: null,
      created_at: "2026-10-21T00:00:00Z",
      updated_at: "2026-10-21T00:00:00Z",
      defaults: {},
      next_generation_start: "2026-11-30",
      completed: false,
    },
    generation: { created_count: 8, already_present: [], errors: [] },
  });
});

describe("TrainingSeriesFormPage", () => {
  it("previews the dates before creating anything", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/Coogee Beach · Court 1/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /preview dates/i }));

    await waitFor(() => expect(screen.getByText(/2 occurrences/)).toBeInTheDocument());
    expect(mockedApi.previewTrainingSeries).toHaveBeenCalledTimes(1);
    expect(mockedApi.createTrainingSeries).not.toHaveBeenCalled();
  });

  it("creates the series and navigates to its dashboard", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/Coogee Beach · Court 1/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /create series/i }));

    await waitFor(() => expect(screen.getByText("Series detail")).toBeInTheDocument());

    const payload = mockedApi.createTrainingSeries.mock.calls[0][0];
    expect(payload.training_template_id).toBe(1);
    expect(payload.weekdays).toEqual(["mon", "wed"]);
    expect(payload.time_zone).toBeTruthy();
    expect(payload.overrides).toMatchObject({ location: "Coogee Beach" });
  });

  it("shows validation errors from the preview", async () => {
    mockedApi.previewTrainingSeries.mockResolvedValue({
      ...preview,
      valid: false,
      total: 0,
      returned: 0,
      occurrences: [],
      errors: ["The recurrence window cannot exceed 366 days"],
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/Coogee Beach · Court 1/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /preview dates/i }));

    expect(
      await screen.findByText("The recurrence window cannot exceed 366 days"),
    ).toBeInTheDocument();
  });
});
