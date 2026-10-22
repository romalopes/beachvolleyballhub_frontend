import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AnalysisSummary } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import AnalysisListPage from "./AnalysisListPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      analyses: vi.fn(),
      organisations: vi.fn(),
      groups: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const analysis: AnalysisSummary = {
  id: 7,
  title: "Side-out review",
  summary: "First-ball side-out decisions from the semifinal.",
  status: "published",
  published_at: "2026-10-20T10:00:00Z",
  archived_at: null,
  created_at: "2026-10-18T10:00:00Z",
  updated_at: new Date().toISOString(),
  can_manage: true,
  can_delete: false,
  can_comment: true,
  created_by: { id: 1, name: "Coach Ana" },
  assigned_coach_profile: { id: 4, name: "Coach Ana" },
  organisation: { id: 2, name: "Beach Club" },
  group: { id: 3, name: "Elite Squad" },
  training_session: { id: 8, title: "Tuesday Training" },
  tournament: null,
  participants: [
    { id: 1, player_profile_id: 5, name: "Jo Player" },
    { id: 2, player_profile_id: 6, name: "Sam Blocker" },
  ],
  video_count: 3,
};

const authValue = (roles: string[]): AuthContextValue => ({
  user: { id: 1, email_address: "coach@example.com", roles } as AuthContextValue["user"],
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
});

const renderPage = (roles = ["coach"], route = "/analyses") => render(
  <AuthContext.Provider value={authValue(roles)}>
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/analyses" element={<AnalysisListPage />} />
        <Route path="/analyses/new" element={<div>New analysis page</div>} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.analyses.mockResolvedValue({
    data: [analysis],
    meta: { page: 1, per_page: 12, total_count: 1 },
  });
  mockedApi.organisations.mockResolvedValue({ data: [{ id: 2, name: "Beach Club" }], meta: {} } as never);
  mockedApi.groups.mockResolvedValue({ data: [{ id: 3, name: "Elite Squad", organisation: { id: 2, name: "Beach Club" } }], meta: {} } as never);
});

describe("AnalysisListPage", () => {
  it("renders the analysis workspace and rich cards", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Side-out review" })).toBeInTheDocument();
    expect(screen.getByText("First-ball side-out decisions from the semifinal.")).toBeInTheDocument();
    expect(screen.getByText("Tuesday Training")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Coach Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Side-out review" })).toHaveAttribute("href", "/analyses/7");
  });

  it("only applies search after submission", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Side-out review" });
    const initialCalls = mockedApi.analyses.mock.calls.length;
    await user.type(screen.getByRole("searchbox", { name: /search analyses/i }), "serve");
    expect(mockedApi.analyses).toHaveBeenCalledTimes(initialCalls);
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(mockedApi.analyses).toHaveBeenLastCalledWith(expect.objectContaining({ q: "serve", page: 1 })));
  });

  it("applies status and organisation filters through the API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Side-out review" });
    await user.click(screen.getByRole("button", { name: "Drafts" }));
    await waitFor(() => expect(mockedApi.analyses).toHaveBeenLastCalledWith(expect.objectContaining({ status: "draft" })));
    await user.selectOptions(screen.getByLabelText(/filter by organisation/i), "2");
    await waitFor(() => expect(mockedApi.analyses).toHaveBeenLastCalledWith(expect.objectContaining({ status: "draft", organisation_id: 2 })));
  });

  it("uses URL-backed next-page navigation", async () => {
    mockedApi.analyses.mockResolvedValue({
      data: [analysis],
      meta: { page: 1, per_page: 12, total_count: 30 },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Page 1 of 3");
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(mockedApi.analyses).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("hides creation actions from players", async () => {
    renderPage(["player"]);
    await screen.findByRole("heading", { name: "Side-out review" });
    expect(screen.queryByRole("link", { name: /new analysis/i })).toBeNull();
  });
});