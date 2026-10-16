import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Organisation } from "../../api";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext";
import AdminTournamentsPage from "./Tournaments";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: { ...actual.api, tournaments: vi.fn(), tournamentOptions: vi.fn(), organisations: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);

const auth: AuthContextValue = {
  user: {
    id: 1,
    name: "Admin",
    email_address: "admin@example.com",
    roles: ["admin"],
    account_id: 1,
  },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
};

function renderPage() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/admin/tournaments"]}>
        <Routes>
          <Route path="/admin/tournaments" element={<AdminTournamentsPage />} />
          <Route path="/admin/tournaments/new" element={<div>New tournament form</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.tournamentOptions.mockResolvedValue({
    scopes: ["club"],
    schemes: ["letter"],
    ordered_levels: ["A"],
    participation_roles: ["player"],
  });
  mockedApi.organisations.mockResolvedValue({
    data: [{ id: 3, name: "Beach Club", depth: 0 } as Organisation],
    meta: { page: 1, per_page: 1, total: 1, total_pages: 1 },
  });
  mockedApi.tournaments.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
  });
});

describe("AdminTournamentsPage", () => {
  it("shows a prominent create action and opens the new tournament form", async () => {
    const user = userEvent.setup();
    renderPage();

    const createButton = screen.getByRole("button", { name: "Create Tournament" });
    expect(createButton).toBeInTheDocument();
    expect(createButton.closest("header")).toHaveClass("page-header");

    await user.click(createButton);

    expect(await screen.findByText("New tournament form")).toBeInTheDocument();
  });

  it("filters tournaments by a searched organisation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Organisations"), "beach");
    await user.click(await screen.findByRole("option", { name: /beach club/i }));

    await waitFor(() => expect(mockedApi.tournaments).toHaveBeenLastCalledWith(
      expect.objectContaining({ organisation_ids: ["3"], page: 1, per_page: 20 }),
    ));
  });
});