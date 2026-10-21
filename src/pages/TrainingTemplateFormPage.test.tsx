import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiValidationError,
  type TrainingTemplate,
} from "../api";
import TrainingTemplateFormPage from "./TrainingTemplateFormPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      organisations: vi.fn(),
      groups: vi.fn(),
      coaches: vi.fn(),
      trainingTemplate: vi.fn(),
      createTrainingTemplate: vi.fn(),
      updateTrainingTemplate: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const saved: TrainingTemplate = {
  id: 5,
  name: "Sunrise Skills",
  description: null,
  organisation_id: 1,
  group_id: null,
  coach_profile_id: null,
  location: "Coogee Beach",
  location_detail: null,
  location_summary: "Coogee Beach",
  level: null,
  capacity: null,
  duration_minutes: 90,
  visibility: "shared",
  status: "active",
  created_by_id: 3,
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/training/templates/new"]}>
      <Routes>
        <Route path="/training/templates/new" element={<TrainingTemplateFormPage />} />
        <Route path="/training/templates" element={<div>Templates list</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.organisations.mockResolvedValue({
    data: [{ id: 1, name: "Sydney Beach Volleyball Club" }],
    meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
  } as never);
  mockedApi.groups.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
  });
  mockedApi.coaches.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 100, total: 0, total_pages: 0 },
  });
  mockedApi.createTrainingTemplate.mockResolvedValue(saved);
});

describe("TrainingTemplateFormPage", () => {
  it("creates a template and returns to the list", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Organisation (optional)")).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Name"), "Sunrise Skills");
    await user.selectOptions(screen.getByLabelText("Organisation (optional)"), "1");
    await user.type(screen.getByLabelText("Location"), "Coogee Beach");
    await user.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(screen.getByText("Templates list")).toBeInTheDocument());

    expect(mockedApi.createTrainingTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sunrise Skills",
        organisation_id: 1,
        location: "Coogee Beach",
        duration_minutes: 90,
        visibility: "shared",
      }),
    );
  });

  it("shows server validation errors", async () => {
    mockedApi.createTrainingTemplate.mockRejectedValue(
      new ApiValidationError(["Name has already been taken"]),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText("Name"), "Duplicate");
    await user.click(screen.getByRole("button", { name: "Create template" }));

    expect(await screen.findByText("Name has already been taken")).toBeInTheDocument();
    expect(mockedApi.createTrainingTemplate).toHaveBeenCalled();
  });
});
