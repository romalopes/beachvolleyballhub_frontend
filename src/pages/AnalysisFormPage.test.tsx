import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import AnalysisFormPage from "./AnalysisFormPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      coaches: vi.fn(),
      organisations: vi.fn(),
      groups: vi.fn(),
      trainingSessions: vi.fn(),
      tournaments: vi.fn(),
      players: vi.fn(),
      analysis: vi.fn(),
      createAnalysis: vi.fn(),
      updateAnalysis: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const renderPage = (route = "/analyses/new") => render(
  <MemoryRouter initialEntries={[route]}>
    <Routes>
      <Route path="/analyses/new" element={<AnalysisFormPage />} />
      <Route path="/analyses/:id/edit" element={<AnalysisFormPage />} />
      <Route path="/analyses/:id" element={<div>Analysis detail</div>} />
      <Route path="/analyses" element={<div>All analyses</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("scrollTo", vi.fn());
  mockedApi.coaches.mockResolvedValue({ data: [{ id: 4, full_name: "Coach Ana" }], meta: {} } as never);
  mockedApi.organisations.mockResolvedValue({ data: [{ id: 2, name: "Beach Club" }], meta: {} } as never);
  mockedApi.groups.mockResolvedValue({ data: [{ id: 3, name: "Elite Squad", organisation: { id: 2, name: "Beach Club" } }], meta: {} } as never);
  mockedApi.trainingSessions.mockResolvedValue([{ id: 8, title: "Tuesday Training" }] as never);
  mockedApi.tournaments.mockResolvedValue({ data: [{ id: 9, name: "Summer Open" }], meta: {} } as never);
  mockedApi.players.mockResolvedValue({
    data: [
      { id: 5, full_name: "Jo Player", preferred_position: "Defender" },
      { id: 6, full_name: "Sam Blocker", level: "Advanced" },
    ],
    meta: {},
  } as never);
  mockedApi.createAnalysis.mockResolvedValue({ analysis: { id: 42 } } as never);
});

describe("AnalysisFormPage steps", () => {
  it("shows one phase at a time and validates Details before continuing", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("heading", { name: "Analysis details" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Participants" })).toBeNull();

    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);
    expect(screen.getByRole("alert")).toHaveTextContent("Title is required before continuing.");
    expect(screen.getByRole("heading", { name: "Analysis details" })).toBeInTheDocument();
  });

  it("navigates through Participants and Review while preserving selections", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Analysis details" });
    await user.type(screen.getByLabelText("Title"), "Side-out review");
    await user.selectOptions(screen.getByLabelText(/assigned coach/i), "4");
    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);

    expect(screen.getByRole("heading", { name: "Participants" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /participants/i })).toHaveAttribute("aria-current", "step");
    await user.click(screen.getByText("Jo Player"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);

    expect(screen.getByRole("heading", { name: "Review your analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review/i })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: "Side-out review" })).toBeInTheDocument();
    expect(screen.getByText("Coach Ana")).toBeInTheDocument();
    expect(screen.getByText("Jo Player")).toBeInTheDocument();
  });

  it("creates the analysis from Review with the complete payload", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Analysis details" });
    await user.type(screen.getByLabelText("Title"), "Tournament final");
    await user.type(screen.getByLabelText("Summary"), "Review transition defense");
    await user.selectOptions(screen.getByLabelText(/organisation/i), "2");
    await user.selectOptions(screen.getByLabelText(/^group/i), "3");
    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);
    await user.click(screen.getByText("Sam Blocker"));
    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);
    await user.click(screen.getAllByRole("button", { name: /create analysis/i })[0]);

    await waitFor(() => expect(screen.getByText("Analysis detail")).toBeInTheDocument());
    expect(mockedApi.createAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      title: "Tournament final",
      summary: "Review transition defense",
      organisation_id: 2,
      group_id: 3,
      player_profile_ids: [6],
    }));
  });
});