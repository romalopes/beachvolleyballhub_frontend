import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    expect(screen.queryByRole("heading", { name: "Review your analysis" })).toBeNull();

    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);
    expect(screen.getByRole("alert")).toHaveTextContent("Title is required before continuing.");
    expect(screen.getByRole("heading", { name: "Analysis details" })).toBeInTheDocument();
  });

  it.skip("selects participants inline on Details and continues to Review", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Analysis details" });
    await user.type(screen.getByLabelText("Title"), "Side-out review");
    await user.selectOptions(screen.getByLabelText(/assigned coach/i), "4");
    // In the new component, preloaded players appear in the browse list when search is empty
    // Click the add button (plus icon) for Jo Player
    await user.click(screen.getByTestId("add-participant-5"));
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /continue/i })[0]);

    expect(screen.getByRole("heading", { name: "Review your analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review/i })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: "Side-out review" })).toBeInTheDocument();
    expect(screen.getByText("Coach Ana")).toBeInTheDocument();
    expect(screen.getByText("Jo Player")).toBeInTheDocument();
  });

  it.skip("searches participants server-side and adds a match from Details", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Analysis details" });
    mockedApi.players.mockResolvedValue({
      data: [{ id: 7, full_name: "Pedro Search", preferred_position: "Setter" }],
      meta: {},
    } as never);

    await user.type(screen.getByLabelText("Search participants to add"), "pedro");
    expect(await screen.findByText("Pedro Search")).toBeInTheDocument();
    expect(mockedApi.players).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "pedro" }),
    );

    // Click the add button for Pedro Search using test ID
    const addButton = screen.getByTestId("add-participant-7");
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /remove pedro search/i })).toBeInTheDocument();
  });

  it.skip("creates the analysis from Review with the complete payload", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Analysis details" });
    await user.type(screen.getByLabelText("Title"), "Tournament final");
    await user.type(screen.getByLabelText("Summary"), "Review transition defense");
    await user.selectOptions(screen.getByLabelText(/organisation/i), "2");
    await user.selectOptions(screen.getByLabelText(/^group/i), "3");
    // Add Sam Blocker via the add button
    await user.click(screen.getByTestId("add-participant-6"));
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